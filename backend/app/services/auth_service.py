import os
import bcrypt  # Dùng bcrypt trực tiếp, không dùng passlib
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
    """Hash password sử dụng bcrypt"""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password với hash"""
    return bcrypt.checkpw(
        plain_password.encode('utf-8'),
        hashed_password.encode('utf-8')
    )

def create_access_token(data: dict) -> str:
    """Tạo JWT access token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    to_encode.update({"exp": expire, "iat": datetime.utcnow()})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt

def verify_token(token: str) -> Optional[dict]:
    """Verify JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        return None

def register_user(db, email: str, username: str, password: str) -> Tuple[bool, str, Optional[dict]]:
    """
    Đăng ký user mới
    
    Returns:
        (success: bool, message: str, data: dict or None)
    """
    try:
        users_collection = db['users']
        
        # Validate input
        if not email or not username or not password:
            return False, "Email, username và password không được để trống", None
        
        if len(password) < 6:
            return False, "Password phải có ít nhất 6 ký tự", None
        
        # Kiểm tra email đã tồn tại chưa
        if users_collection.find_one({'email': email.lower().strip()}):
            return False, "Email đã được sử dụng", None
        
        # Kiểm tra username đã tồn tại chưa
        if users_collection.find_one({'username': username.strip()}):
            return False, "Username đã được sử dụng", None
        
        # Hash password
        hashed_pwd = hash_password(password)
        
        # Tạo user document
        user_doc = {
            'email': email.lower().strip(),
            'username': username.strip(),
            'password_hash': hashed_pwd,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
            'is_active': True
        }
        
        # Insert vào database
        result = users_collection.insert_one(user_doc)
        user_id = str(result.inserted_id)
        
        # Tạo token
        token = create_access_token({
            "user_id": user_id,
            "email": email.lower().strip()
        })
        
        # Trả về thông tin user
        user_data = {
            'user_id': user_id,
            'email': email.lower().strip(),
            'username': username.strip(),
            'token': token
        }
        
        return True, "Đăng ký thành công", user_data
        
    except Exception as e:
        print(f"Register error: {e}")
        return False, f"Lỗi: {str(e)}", None

def login_user(db, email: str, password: str) -> Tuple[bool, str, Optional[dict]]:
    """
    Đăng nhập user
    
    Returns:
        (success: bool, message: str, data: dict or None)
    """
    try:
        users_collection = db['users']
        
        # Validate input
        if not email or not password:
            return False, "Email và password không được để trống", None
        
        # Tìm user theo email
        user = users_collection.find_one({'email': email.lower().strip()})
        
        if not user:
            return False, "Email hoặc password không đúng", None
        
        # Kiểm tra account có active không
        if not user.get('is_active', True):
            return False, "Tài khoản đã bị vô hiệu hóa", None
        
        # Verify password
        if not verify_password(password, user['password_hash']):
            return False, "Email hoặc password không đúng", None
        
        # Tạo token
        user_id = str(user['_id'])
        token = create_access_token({
            "user_id": user_id,
            "email": user['email']
        })
        
        # Cập nhật last login
        users_collection.update_one(
            {'_id': user['_id']},
            {'$set': {'last_login': datetime.utcnow()}}
        )
        
        # Trả về thông tin user
        user_data = {
            'user_id': user_id,
            'email': user['email'],
            'username': user['username'],
            'token': token
        }
        
        return True, "Đăng nhập thành công", user_data
        
    except Exception as e:
        print(f"Login error: {e}")
        return False, f"Lỗi: {str(e)}", None

def get_user_from_token(db, token: str) -> Optional[dict]:
    """
    Lấy thông tin user từ token
    
    Returns:
        user dict or None
    """
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
            'username': user['username']
        }
        
    except Exception as e:
        print(f"Error getting user from token: {e}")
        return None