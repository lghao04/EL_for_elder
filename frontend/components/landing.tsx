"use client"

import { Button } from "./../components/ui/button"
import { Mic, Headphones, MessageCircle, ArrowRight } from "lucide-react"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-blue-50 to-yellow-50">
      <nav className="flex items-center justify-between px-6 py-6 border-b-4 border-primary bg-white">
        <div className="flex items-center gap-3">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
            <span className="text-primary-foreground font-bold text-3xl">E</span>
          </div>
          <span className="font-bold text-3xl text-foreground">EnglishFlow</span>
        </div>
        <div className="flex gap-4">
          <Button variant="ghost" className="text-xl h-14 px-8 font-semibold">
            Sign In
          </Button>
          <Button className="bg-primary text-primary-foreground hover:bg-blue-700 text-xl h-14 px-8 font-semibold shadow-lg">
            Get Started
          </Button>
        </div>
      </nav>

      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-2 gap-16 items-center mb-24">
          <div className="space-y-8">
            <h1 className="text-6xl md:text-7xl font-bold text-foreground leading-tight text-balance">
              Learn English Together!
            </h1>
            <p className="text-2xl text-foreground leading-relaxed">
              Fun, easy lessons with AI that listens to you. Perfect for kids and everyone!
            </p>
            <div className="flex gap-4 pt-6 flex-wrap">
              <Button
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-blue-700 gap-2 h-20 px-12 text-2xl font-bold shadow-lg rounded-2xl"
              >
                Start Now <ArrowRight className="w-6 h-6" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-20 px-12 text-2xl font-bold border-4 rounded-2xl bg-transparent"
              >
                Learn More
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-blue-300 to-blue-200 rounded-3xl p-8 shadow-lg h-56 flex items-center justify-center transform hover:scale-105 transition-transform">
              <Mic className="w-24 h-24 text-white" />
            </div>
            <div className="bg-gradient-to-br from-yellow-300 to-yellow-200 rounded-3xl p-8 shadow-lg h-56 flex items-center justify-center transform hover:scale-105 transition-transform">
              <Headphones className="w-24 h-24 text-white" />
            </div>
            <div className="bg-gradient-to-br from-green-300 to-green-200 rounded-3xl p-8 shadow-lg h-56 flex items-center justify-center transform hover:scale-105 transition-transform">
              <MessageCircle className="w-24 h-24 text-white" />
            </div>
            <div className="bg-gradient-to-br from-pink-300 to-pink-200 rounded-3xl p-8 shadow-lg h-56 flex items-center justify-center transform hover:scale-105 transition-transform">
              <span className="text-7xl">🎉</span>
            </div>
          </div>
        </div>

        <section className="py-24">
          <h2 className="text-5xl font-bold text-center mb-16 text-foreground text-balance">
            Three Easy Ways to Learn!
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <Mic className="w-20 h-20" />,
                title: "Say the Words",
                desc: "Speak into your microphone. We listen and help you sound perfect!",
                color: "bg-blue-100",
                accentColor: "text-blue-600",
              },
              {
                icon: <Headphones className="w-20 h-20" />,
                title: "Listen & Learn",
                desc: "Hear English spoken clearly. Answer fun questions about what you hear!",
                color: "bg-yellow-100",
                accentColor: "text-yellow-600",
              },
              {
                icon: <MessageCircle className="w-20 h-20" />,
                title: "Chat with AI",
                desc: "Have a real conversation with our friendly AI teacher. No pressure!",
                color: "bg-green-100",
                accentColor: "text-green-600",
              },
            ].map((feature, i) => (
              <div
                key={i}
                className={`rounded-3xl p-10 border-4 border-gray-300 ${feature.color} hover:shadow-xl transition-shadow`}
              >
                <div className={`${feature.accentColor} mb-6`}>{feature.icon}</div>
                <h3 className="text-3xl font-bold text-foreground mb-4">{feature.title}</h3>
                <p className="text-xl text-foreground leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="py-24 bg-white rounded-3xl border-4 border-gray-300 p-12">
          <h2 className="text-5xl font-bold text-center mb-16 text-foreground text-balance">Your Learning Journey</h2>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: "1", title: "Choose Your Level", desc: "Pick your age or skill" },
              { step: "2", title: "Pick What to Learn", desc: "Speaking or listening?" },
              { step: "3", title: "Start Learning!", desc: "Follow fun lessons" },
              { step: "4", title: "Get Your Score", desc: "See how you did!" },
            ].map((item, i) => (
              <div key={i} className="flex flex-col items-center gap-4 p-6">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-blue-600 text-white flex items-center justify-center font-bold text-4xl shadow-lg">
                  {item.step}
                </div>
                <h3 className="font-bold text-2xl text-foreground text-center">{item.title}</h3>
                <p className="text-lg text-foreground text-center">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="py-24 text-center space-y-8">
          <h2 className="text-5xl font-bold text-foreground text-balance">Ready to Learn English?</h2>
          <p className="text-2xl text-foreground max-w-3xl mx-auto">
            Come join thousands of kids and adults learning together. It's fun, easy, and you can start right now!
          </p>
          <Button
            size="lg"
            className="bg-gradient-to-r from-primary to-blue-600 text-white hover:shadow-2xl text-2xl h-20 px-16 font-bold rounded-2xl shadow-lg"
          >
            Start Your Free Trial <ArrowRight className="w-6 h-6" />
          </Button>
        </section>
      </section>

      <footer className="border-t-4 border-primary py-12 mt-12 bg-white">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between flex-wrap gap-6">
          <p className="text-lg text-foreground font-semibold">© 2025 EnglishFlow. All rights reserved.</p>
          <div className="flex gap-8 text-lg font-semibold">
            <a href="#" className="text-primary hover:text-blue-700 transition-colors">
              Privacy
            </a>
            <a href="#" className="text-primary hover:text-blue-700 transition-colors">
              Terms
            </a>
            <a href="#" className="text-primary hover:text-blue-700 transition-colors">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
