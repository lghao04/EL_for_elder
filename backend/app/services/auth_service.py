import os
import bcrypt
from datetime import datetime, timedelta
from typing import Optional, Tuple
from jose import JWTError, jwt
from dotenv import load_dotenv
from bson import ObjectId

load_dotenv()

# JWT Configuration
JWT_SECRET = os.getenv('JWT_SECRET', 'your-secret-key-change-this-in-production')
JWT_ALGORITHM = os.getenv('JWT_ALGORITHM', 'HS256')
JWT_EXPIRATION_HOURS = int(os.getenv('JWT_EXPIRATION_HOURS', 24))

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(
        plain_password.encode('utf-8'),
        hashed_password.encode('utf-8')
    )

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    to_encode.update({"exp": expire, "iat": datetime.utcnow()})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt

def verify_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        return None

def register_user(db, email: str, username: str, password: str) -> Tuple[bool, str, Optional[dict]]:
    try:
        users_collection = db['users']
        
        if not email or not username or not password:
            return False, "Email, username và password không được để trống", None
        
        if len(password) < 6:
            return False, "Password phải có ít nhất 6 ký tự", None
        
        if users_collection.find_one({'email': email.lower().strip()}):
            return False, "Email đã được sử dụng", None
        
        if users_collection.find_one({'username': username.strip()}):
            return False, "Username đã được sử dụng", None
        
        hashed_pwd = hash_password(password)
        
        user_doc = {
            'email': email.lower().strip(),
            'username': username.strip(),
            'password_hash': hashed_pwd,
            'account_name': None,       # ← Tên hiển thị (full name)
            'profile_image': None,      # ← Link ảnh đại diện
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
            'is_active': True
        }
        
        result = users_collection.insert_one(user_doc)
        user_id = str(result.inserted_id)
        
        token = create_access_token({
            "user_id": user_id,
            "email": email.lower().strip()
        })
        
        user_data = {
            'user_id': user_id,
            'email': email.lower().strip(),
            'username': username.strip(),
            'account_name': None,
            'profile_image': None,
            'token': token
        }
        
        return True, "Đăng ký thành công", user_data
        
    except Exception as e:
        print(f"Register error: {e}")
        return False, f"Lỗi: {str(e)}", None

def login_user(db, username: str, password: str) -> Tuple[bool, str, Optional[dict]]:
    try:
        users_collection = db['users']

        if not username or not password:
            return False, "Username và password không được để trống", None

        user = users_collection.find_one({'username': username.lower().strip()})

        if not user:
            return False, "Username không tồn tại", None

        if not user.get('is_active', True):
            return False, "Tài khoản đã bị vô hiệu hóa", None

        if not verify_password(password, user['password_hash']):
            return False, "Password không đúng", None

        user_id = str(user['_id'])
        token = create_access_token({
            "user_id": user_id,
            "username": user['username']
        })

        users_collection.update_one(
            {'_id': user['_id']},
            {'$set': {'last_login': datetime.utcnow()}}
        )

        return True, "Đăng nhập thành công", {
            'user_id': user_id,
            'email': user['email'],
            'username': user['username'],
            'account_name': user.get('account_name'),       # ← Trả về khi login
            'profile_image': user.get('profile_image'),     # ← Trả về khi login
            'token': token
        }

    except Exception as e:
        print(f"Login error: {e}")
        return False, f"Lỗi: {str(e)}", None


def get_user_from_token(db, token: str) -> Optional[dict]:
    try:
        payload = verify_token(token)
        if not payload:
            return None
        
        users_collection = db['users']
        user = users_collection.find_one({'_id': ObjectId(payload['user_id'])})
        
        if not user:
            return None
        
        return {
            'user_id': str(user['_id']),
            'email': user['email'],
            'username': user['username'],
            'account_name': user.get('account_name'),       # ← Thêm vào
            'profile_image': user.get('profile_image'),     # ← Thêm vào
        }
        
    except Exception as e:
        print(f"Error getting user from token: {e}")
        return None


# ──────────────────────────────────────────────
# HÀM MỚI: Cập nhật profile
# ──────────────────────────────────────────────

def update_account_name(db, user_id: str, account_name: str) -> Tuple[bool, str, Optional[dict]]:
    """
    Cập nhật tên hiển thị (full name) của user.

    Returns:
        (success, message, updated_fields)
    """
    try:
        users_collection = db['users']

        account_name = account_name.strip()
        if not account_name:
            return False, "Account name không được để trống", None

        if len(account_name) > 100:
            return False, "Account name không được vượt quá 100 ký tự", None

        result = users_collection.update_one(
            {'_id': ObjectId(user_id)},
            {'$set': {
                'account_name': account_name,
                'updated_at': datetime.utcnow()
            }}
        )

        if result.matched_count == 0:
            return False, "Không tìm thấy user", None

        return True, "Cập nhật tên thành công", {'account_name': account_name}

    except Exception as e:
        print(f"Update account name error: {e}")
        return False, f"Lỗi: {str(e)}", None


def update_profile_image(db, user_id: str, image_url: str) -> Tuple[bool, str, Optional[dict]]:
    """
    Cập nhật link ảnh đại diện của user.

    Returns:
        (success, message, updated_fields)
    """
    try:
        users_collection = db['users']

        image_url = image_url.strip()
        if not image_url:
            return False, "Image URL không được để trống", None

        # Validate URL cơ bản
        if not (image_url.startswith('http://') or image_url.startswith('https://')):
            return False, "Image URL không hợp lệ (phải bắt đầu bằng http/https)", None

        result = users_collection.update_one(
            {'_id': ObjectId(user_id)},
            {'$set': {
                'profile_image': image_url,
                'updated_at': datetime.utcnow()
            }}
        )

        if result.matched_count == 0:
            return False, "Không tìm thấy user", None

        return True, "Cập nhật ảnh đại diện thành công", {'profile_image': image_url}

    except Exception as e:
        print(f"Update profile image error: {e}")
        return False, f"Lỗi: {str(e)}", None


def update_profile(db, user_id: str, account_name: Optional[str] = None, image_url: Optional[str] = None) -> Tuple[bool, str, Optional[dict]]:
    """
    Cập nhật cùng lúc account_name và/hoặc profile_image.
    Dùng hàm này nếu frontend gửi cả 2 trong 1 request.

    Returns:
        (success, message, updated_fields)
    """
    try:
        users_collection = db['users']

        fields_to_update: dict = {'updated_at': datetime.utcnow()}

        if account_name is not None:
            account_name = account_name.strip()
            if not account_name:
                return False, "Account name không được để trống", None
            if len(account_name) > 100:
                return False, "Account name không được vượt quá 100 ký tự", None
            fields_to_update['account_name'] = account_name

        if image_url is not None:
            image_url = image_url.strip()
            if not image_url:
                return False, "Image URL không được để trống", None
            if not (image_url.startswith('http://') or image_url.startswith('https://')):
                return False, "Image URL không hợp lệ", None
            fields_to_update['profile_image'] = image_url

        if len(fields_to_update) == 1:  # Chỉ có updated_at, không có gì để update
            return False, "Không có thông tin nào để cập nhật", None

        result = users_collection.update_one(
            {'_id': ObjectId(user_id)},
            {'$set': fields_to_update}
        )

        if result.matched_count == 0:
            return False, "Không tìm thấy user", None

        # Trả về các field đã update (bỏ updated_at)
        fields_to_update.pop('updated_at')
        return True, "Cập nhật profile thành công", fields_to_update

    except Exception as e:
        print(f"Update profile error: {e}")
        return False, f"Lỗi: {str(e)}", None