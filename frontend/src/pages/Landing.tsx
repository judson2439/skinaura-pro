import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getAuthSession } from '@/lib/authStorage';
import { 
  Sparkles, 
  User, 
  Users, 
  Flame, 
  Trophy, 
  Target, 
  Zap, 
  Check,
  FileText,
  Loader2
} from 'lucide-react';
import AuthModal from '@/components/auth/AuthModal';

// Placeholder images - replace with actual images
const HERO_IMAGE = 'https://emqiscdnvmjjrqapccib.supabase.co/storage/v1/object/public/progress-photos/primary.jpeg';

const PROFESSIONAL_IMAGES = [
  'https://d64gsuwffb70l.cloudfront.net/6934399edba891717b312123_1766523991930_b65a01cd.jpeg',
  'https://d64gsuwffb70l.cloudfront.net/6934399edba891717b312123_1766524635631_66fa63e8.jpeg',
  'https://d64gsuwffb70l.cloudfront.net/6934399edba891717b312123_1766524510579_79b4cf4d.jpeg',
  'https://d64gsuwffb70l.cloudfront.net/6934399edba891717b312123_1766524271679_72df9698.jpeg',
  'https://d64gsuwffb70l.cloudfront.net/6934399edba891717b312123_1766524385418_a19d9ece.jpeg',
];

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authRole, setAuthRole] = useState<'client' | 'professional' | undefined>(undefined);

  // Check for query params to open auth modal (e.g., after password reset)
  useEffect(() => {
    const loginParam = searchParams.get('login');
    const signupParam = searchParams.get('signup');
    
    if (loginParam === 'true') {
      setAuthMode('login');
      setIsAuthModalOpen(true);
      // Clear the query param after handling
      searchParams.delete('login');
      setSearchParams(searchParams, { replace: true });
    } else if (signupParam) {
      setAuthMode('signup');
      if (signupParam === 'client' || signupParam === 'professional') {
        setAuthRole(signupParam);
      }
      setIsAuthModalOpen(true);
      // Clear the query param after handling
      searchParams.delete('signup');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Session check on page load/refresh
  // If user is already authenticated, redirect to their dashboard
  useEffect(() => {
    const authSession = getAuthSession();
    const hasValidAuth = authSession && authSession.token;

    // Session check complete
    if (hasValidAuth && authSession?.user) {
      const userRole = authSession.user.role;
      // User is authenticated, redirect to appropriate dashboard
      if (userRole === 'client') {
        console.log('Authenticated client found, redirecting to client dashboard');
        navigate('/client', { replace: true });
      } else if (userRole === 'professional') {
        console.log('Authenticated professional found, redirecting to professional dashboard');
        navigate('/professional', { replace: true });
      } else if (userRole === 'admin') {
        navigate('/admin', { replace: true });
      }
    }
    setIsCheckingSession(false);
  }, [navigate]);

  const openAuthModal = (mode: 'login' | 'signup', role?: 'client' | 'professional') => {
    setAuthMode(mode);
    setAuthRole(role);
    setIsAuthModalOpen(true);
  };

  // Show loading while checking auth state
  if (isCheckingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F9F7F5] via-white to-[#F9F7F5]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#CFAFA3]" />
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Check if user has valid session (will redirect if so)
  const authSession = getAuthSession();
  if (authSession && authSession.token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F9F7F5] via-white to-[#F9F7F5]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#CFAFA3]" />
          <p className="text-gray-500">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F9F7F5] via-white to-[#F9F7F5]">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#CFAFA3] to-[#E8D5D0] flex items-center justify-center">
                <img className="text-[#2D2A3E]" src={'https://emqiscdnvmjjrqapccib.supabase.co/storage/v1/object/public/progress-photos/logo.png'} width={24} height={24}/> 
              </div>
              <div className="flex flex-col">
                <img 
                  src="https://d64gsuwffb70l.cloudfront.net/6934399edba891717b312123_1767940504418_b46cd2a4.png" 
                  alt="SkinAura" 
                  className="mt-1 h-4 w-auto object-contain"
                />
                <p className="text-md text-[#CFAFA3]">PRO</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <a href="https://skinaura.ai" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-600 hover:text-[#CFAFA3] transition-colors hidden sm:block">
                SkinAura AI
              </a>
              <a href="https://skinaura.circle.so/" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-600 hover:text-[#CFAFA3] transition-colors hidden sm:block">
                Community
              </a>
              <button
                onClick={() => openAuthModal('login')}
                className="px-4 py-2 text-sm font-medium text-[#2D2A3E] hover:text-[#CFAFA3] transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={() => openAuthModal('signup')}
                className="px-4 py-2 bg-gradient-to-r from-[#CFAFA3] to-[#B89A8E] text-white rounded-lg text-sm font-medium hover:shadow-lg hover:shadow-[#CFAFA3]/30 transition-all"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#CFAFA3]/10 rounded-full mb-6">
                <img className="text-[#2D2A3E]" src={'https://emqiscdnvmjjrqapccib.supabase.co/storage/v1/object/public/progress-photos/logo.png'} width={16} height={16}/>
                <span className="text-sm font-medium text-[#CFAFA3]">Skincare is Selfcare. Consistency is Our Strategy!</span>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-bold text-[#2D2A3E] mb-6 leading-tight">
                Professional Guidance.
                <br />
                <span className="text-[#CFAFA3]">Measurable Progress.</span>
              </h1>
              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                Follow an expert-designed routine, monitor consistency, and document progress over time—so your plan stays clear and your results stay measurable.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => openAuthModal('signup', 'client')}
                  className="flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-[#CFAFA3] to-[#B89A8E] text-white rounded-xl font-medium hover:shadow-lg hover:shadow-[#CFAFA3]/30 transition-all"
                >
                  <User className="w-5 h-5" />
                  Join as Client
                </button>
                <button
                  onClick={() => openAuthModal('signup', 'professional')}
                  className="flex items-center justify-center gap-2 px-8 py-4 bg-[#2D2A3E] text-white rounded-xl font-medium hover:bg-[#3D3A4E] transition-all"
                >
                  <Users className="w-5 h-5" />
                  Join as Professional
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-4">
                Already have an account?{' '}
                <button onClick={() => openAuthModal('login')} className="text-[#CFAFA3] font-medium hover:underline">
                  Sign in
                </button>
              </p>
            </div>
            <div className="relative">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl">
                <img src={HERO_IMAGE} alt="SkinAura PRO" className="w-auto h-auto max-w-full object-contain" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#2D2A3E]/60 via-transparent to-transparent" />
              </div>

              {/* Floating Stats Cards */}
              <div className="absolute -bottom-6 -left-6 bg-white rounded-2xl p-4 shadow-xl border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                    <Flame className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[#2D2A3E]">14</p>
                    <p className="text-sm text-gray-500">Day Streak</p>
                  </div>
                </div>
              </div>
              <div className="absolute -top-4 -right-4 bg-white rounded-2xl p-4 shadow-xl border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#CFAFA3] to-[#E8D5D0] flex items-center justify-center">
                    <Trophy className="w-6 h-6 text-[#2D2A3E]" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[#2D2A3E]">Gold</p>
                    <p className="text-sm text-gray-500">Level</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-serif font-bold text-[#2D2A3E] mb-4">Why Choose SkinAura PRO?</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">Designed to support every skin type, SkinAura PRO pairs AI-powered insights with progress tracking—so providers stay informed and clients stay consistent.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gradient-to-br from-[#F9F7F5] to-white rounded-2xl p-8 border border-gray-100">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#CFAFA3] to-[#E8D5D0] flex items-center justify-center mb-6">
                <Target className="w-7 h-7 text-[#2D2A3E]" />
              </div>
              <h3 className="text-xl font-serif font-bold text-[#2D2A3E] mb-3">Routine Tracking</h3>
              <p className="text-gray-600">Log morning and evening routines with ease. Add reminders and reorder prompts so clients stay consistent.</p>
            </div>
            <div className="bg-gradient-to-br from-[#F9F7F5] to-white rounded-2xl p-8 border border-gray-100">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#D4A853] to-[#C49B48] flex items-center justify-center mb-6">
                <Flame className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-serif font-bold text-[#2D2A3E] mb-3">Consistency Momentum</h3>
              <p className="text-gray-600">Support follow-through with streak tracking and gentle nudges—so clients build habits that actually last.</p>
            </div>
            <div className="bg-gradient-to-br from-[#F9F7F5] to-white rounded-2xl p-8 border border-gray-100">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#4A7C7E] to-[#5B9A9C] flex items-center justify-center mb-6">
                <Zap className="w-7 h-7 text-white" />
              </div>

              <h3 className="text-xl font-serif font-bold text-[#2D2A3E] mb-3">Progress Milestones</h3>
              <p className="text-gray-600">Move through Bronze, Silver, Gold, Platinum, and Diamond milestones—designed to reinforce consistency and celebrate progress.</p>
            </div>
          </div>
        </div>
      </section>


      {/* For Professionals Section */}
      <section id="professionals" className="py-16 px-4 sm:px-6 lg:px-8 bg-[#000000]">

        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full mb-6">
                <Users className="w-4 h-4 text-[#CFAFA3]" />
                <span className="text-sm font-medium text-[#CFAFA3]">For Professionals</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-serif font-bold text-white mb-6">
                Empower Your Clients With Consistent, Trackable Care
              </h2>
              <p className="text-white/80 mb-8 leading-relaxed">
                Support clients between visits with one clear system. Track routine follow-through, strengthen client engagement, send timely SMS reminders, and review progress over time—so you can refine the plan with clarity—backed by what you’re actually seeing.
              </p>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3 text-white/90">
                  <Check className="w-5 h-5 text-[#CFAFA3]" />
                  Real-time routine tracking
                </li>
                <li className="flex items-center gap-3 text-white/90">
                  <Check className="w-5 h-5 text-[#CFAFA3]" />
                  SMS text reminders
                </li>
                <li className="flex items-center gap-3 text-white/90">
                  <Check className="w-5 h-5 text-[#CFAFA3]" />
                  Progress insights dashboard
                </li>
                <li className="flex items-center gap-3 text-white/90">
                  <Check className="w-5 h-5 text-[#CFAFA3]" />
                  Product refill notifications
                </li>
              </ul>
              <div className="flex flex-col items-start gap-3">
                <a
                  href="https://calendly.com/skinaura/brand-presentation-or-product-demo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[#CFAFA3] to-[#B89A8E] text-white rounded-xl font-medium hover:shadow-lg hover:shadow-[#CFAFA3]/30 transition-all"
                >
                  <img className="text-[#2D2A3E]" src={'https://emqiscdnvmjjrqapccib.supabase.co/storage/v1/object/public/progress-photos/logo.png'} width={20} height={20}/>
                  Book a Private Demo
                </a>

                <button
                  onClick={() => openAuthModal('signup', 'professional')}
                  className="text-sm text-white/70 hover:text-[#CFAFA3] transition-colors"
                >
                  Solo provider? Start Essentials Trial →
                </button>
              </div>

            </div>
            <div className="grid grid-cols-2 gap-4">
              {PROFESSIONAL_IMAGES.map((img, i) => (
                <div key={i} className={`rounded-2xl overflow-hidden ${i === 0 ? 'col-span-2' : ''}`}>
                  <img src={img} alt={`Professional ${i + 1}`} className={`w-full object-cover ${i === 0 ? 'h-64' : 'h-48'}`} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section for AEO */}
      <section id="faq" className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-[#F9F7F5] to-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-serif font-bold text-[#2D2A3E] mb-4">Frequently Asked Questions</h2>
            <p className="text-gray-600">Everything you need to know about SkinAura PRO</p>
          </div>
          
          <div className="space-y-4" itemScope itemType="https://schema.org/FAQPage">
            {/* FAQ Item 1 */}
            <div 
              className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
              itemScope 
              itemProp="mainEntity" 
              itemType="https://schema.org/Question"
            >
              <h3 className="font-serif font-bold text-lg text-[#2D2A3E] mb-3" itemProp="name">
                What is SkinAura PRO?
              </h3>
              <div itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
                <p className="text-gray-600" itemProp="text">
                  SkinAura PRO is a professional skincare tracking platform designed for skincare professionals (estheticians, dermatologists, med spas) and their clients. It helps track skincare routines, manage products, analyze progress photos, and monitor client compliance with AI-powered insights specifically designed for all skin tones.
                </p>
              </div>
            </div>

            {/* FAQ Item 2 */}
            <div 
              className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
              itemScope 
              itemProp="mainEntity" 
              itemType="https://schema.org/Question"
            >
              <h3 className="font-serif font-bold text-lg text-[#2D2A3E] mb-3" itemProp="name">
                Is SkinAura PRO designed for all skin tones?
              </h3>
              <div itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
                <p className="text-gray-600" itemProp="text">
                  Yes, SkinAura PRO is specifically designed with multicultural skin in mind. The AI analysis and product recommendations are optimized for diverse skin tones, addressing common concerns like hyperpigmentation, uneven skin tone, and texture.
                </p>
              </div>
            </div>

            {/* FAQ Item 3 */}
            <div 
              className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
              itemScope 
              itemProp="mainEntity" 
              itemType="https://schema.org/Question"
            >
              <h3 className="font-serif font-bold text-lg text-[#2D2A3E] mb-3" itemProp="name">
                Can skincare professionals monitor their clients' progress?
              </h3>
              <div itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
                <p className="text-gray-600" itemProp="text">
                  Yes, professionals can view client compliance rates, routine completion status, progress photos, and send SMS reminders to clients who miss their routines. The platform provides analytics dashboards showing overall client performance.
                </p>
              </div>
            </div>

            {/* FAQ Item 4 */}
            <div 
              className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
              itemScope 
              itemProp="mainEntity" 
              itemType="https://schema.org/Question"
            >
              <h3 className="font-serif font-bold text-lg text-[#2D2A3E] mb-3" itemProp="name">
                Does SkinAura PRO integrate with other tools?
              </h3>
              <div itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
                <p className="text-gray-600" itemProp="text">
                  SkinAura PRO integrates with Twilio for SMS reminders, supports Shopify product imports, bulk CSV product imports, and connects with the SkinAura AI skin analysis platform for advanced skin scanning capabilities. Designed to complement your booking/POS—without replacing it.
                </p>
              </div>
            </div>

            {/* FAQ Item 5 */}
            <div 
              className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
              itemScope 
              itemProp="mainEntity" 
              itemType="https://schema.org/Question"
            >
              <h3 className="font-serif font-bold text-lg text-[#2D2A3E] mb-3" itemProp="name">
                How does the gamification system work?
              </h3>
              <div itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
                <p className="text-gray-600" itemProp="text">
                  Clients earn points for completing routines (50 points each), with bonus points for maintaining streaks. They progress through Bronze, Silver, Gold, Platinum, and Diamond levels. Badges are awarded for milestones like first routine completion, 7-day streaks, and 30-day consistency. Professionals determine what rewards to provide clients to incentivize rebooking and consistency.
                </p>
              </div>
            </div>
          </div>

          {/* CTA after FAQ */}
          <div className="mt-12 text-center">
            <p className="text-gray-600 mb-4">Ready to transform your skincare routine?</p>
            <div className="flex flex-col items-center gap-3">
              <a
                href="https://calendly.com/skinaura/brand-presentation-or-product-demo"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[#CFAFA3] to-[#B89A8E] text-white rounded-xl font-medium hover:shadow-lg hover:shadow-[#CFAFA3]/30 transition-all"
              >
                <img className="text-[#2D2A3E]" src={'https://emqiscdnvmjjrqapccib.supabase.co/storage/v1/object/public/progress-photos/logo.png'} width={20} height={20}/>
                Book a Private Demo
              </a>

              <button
                onClick={() => openAuthModal('signup', 'professional')}
                className="text-sm text-gray-500 hover:text-[#CFAFA3] transition-colors"
              >
                Solo provider? Start Essentials Trial →
              </button>
            </div>
          </div>
        </div>
      </section>


      {/* Footer */}
      <footer className="py-8 px-4 sm:px-6 lg:px-8 bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#CFAFA3] to-[#E8D5D0] flex items-center justify-center">
                <img className="text-[#2D2A3E]" src={'https://emqiscdnvmjjrqapccib.supabase.co/storage/v1/object/public/progress-photos/logo.png'} width={16} height={16}/>
              </div>
              <span className="font-serif font-bold text-[#2D2A3E]">SkinAura PRO</span>
            </div>
            <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500" aria-label="Footer navigation">
              <a href="#features" className="hover:text-[#CFAFA3] transition-colors">Features</a>
              <a href="#professionals" className="hover:text-[#CFAFA3] transition-colors">For Professionals</a>
              <a href="#faq" className="hover:text-[#CFAFA3] transition-colors">FAQ</a>
              <a href="https://skinaura.ai" target="_blank" rel="noopener noreferrer" className="hover:text-[#CFAFA3] transition-colors">SkinAura AI</a>
              <a href="https://skinaura-ai.myshopify.com/pages/app-skin-analysis-page" target="_blank" rel="noopener noreferrer" className="hover:text-[#CFAFA3] transition-colors">SkinAura Scan</a>
              <a href="https://skinaura.circle.so/" target="_blank" rel="noopener noreferrer" className="hover:text-[#CFAFA3] transition-colors">Community</a>
            </nav>
            <p className="text-sm text-gray-400">© 2025 SkinAura AI. Skincare is Selfcare.</p>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authMode}
        initialRole={authRole}
      />
    </div>
  );
};

export default Landing;
