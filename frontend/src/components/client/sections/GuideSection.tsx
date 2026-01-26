import React, { useState } from 'react';
import {
  CheckCircle,
  ChevronDown,
  MessageCircle,
  AlertCircle,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface GuideSectionProps {
  onNavigateToView?: (viewId: string) => void;
}

interface FAQItem {
  id: number;
  question: string;
  answer: string;
}

// ============================================================================
// FAQ DATA
// ============================================================================

const FAQ_DATA: FAQItem[] = [
  {
    id: 1,
    question: 'Do I have to upload photos?',
    answer: `Photos are strongly recommended. They're the best way to track progress objectively. Your provider uses them to adjust your routine and celebrate wins with you.`,
  },
  {
    id: 2,
    question: 'What if I miss a few days?',
    answer: `Life happens! Just pick up where you left off. Don't try to "catch up" by doubling products—that can cause irritation. If you miss more than a week, message your provider for guidance.`,
  },
  {
    id: 3,
    question: 'Can I use products not in my routine?',
    answer: `Please check with your provider first. Even products you've used before can interact with your new routine. It's better to ask than to risk setbacks.`,
  },
  {
    id: 4,
    question: 'What if something burns?',
    answer: `Stop using that product immediately and message your provider. Some tingling is normal with actives, but burning, stinging, or redness that lasts more than a few minutes is not okay.`
  },
  {
    id: 5,
    question: 'Why are reminders important?',
    answer: `Consistency is everything in skincare. Reminders help you build the habit. Most people see results when they follow their routine 90%+ of the time. The app makes that easier.`
  },
];

// ============================================================================
// FAQ ACCORDION ITEM
// ============================================================================

interface FAQAccordionItemProps {
  faq: FAQItem;
  isExpanded: boolean;
  onToggle: () => void;
}

const FAQAccordionItem: React.FC<FAQAccordionItemProps> = ({ faq, isExpanded, onToggle }) => {
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50/50 transition-colors"
      >
        <span className="font-medium text-gray-700 text-sm">{faq.question}</span>
        <div className="text-gray-400 ml-4 flex-shrink-0">
          <ChevronDown 
            className={`w-4 h-4 transition-transform duration-300 ease-out ${
              isExpanded ? 'rotate-180' : 'rotate-0'
            }`} 
          />
        </div>
      </button>
      <div
        className="grid transition-all duration-300 ease-out"
        style={{
          gridTemplateRows: isExpanded ? '1fr' : '0fr',
        }}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4">
            <p className="text-gray-600 text-sm leading-relaxed">{faq.answer}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const GuideSection: React.FC<GuideSectionProps> = ({ onNavigateToView }) => {
  const [expandedFAQs, setExpandedFAQs] = useState<number[]>([]);

  const toggleFAQ = (faqId: number) => {
    setExpandedFAQs((prev) =>
      prev.includes(faqId) ? prev.filter((id) => id !== faqId) : [...prev, faqId]
    );
  };

  const handleMessageProvider = () => {
    // Navigate to notifications or trigger chat
    if (onNavigateToView) {
      onNavigateToView('notifications');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-8">
      {/* Hero Header */}
      <div className="text-center pt-4">
        <h1 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 mb-3">
          Welcome to Your Skincare Plan
        </h1>
        <p className="text-gray-500 text-sm md:text-base max-w-xl mx-auto">
          Your provider has created a personalized routine just for you. Let's get you started in 3 minutes.
        </p>
      </div>

      {/* What is SkinAura PRO? */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <h2 className="font-serif font-bold text-lg text-gray-900 mb-4">What is SkinAura PRO?</h2>
        <p className="text-gray-600 text-sm mb-4">Think of it as your skincare companion between visits. It helps you:</p>
        <ul className="space-y-3">
          <li className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-[#4A9BAF] flex-shrink-0 mt-0.5" />
            <span className="text-gray-700 text-sm">Follow your exact routine (AM/PM steps)</span>
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-[#4A9BAF] flex-shrink-0 mt-0.5" />
            <span className="text-gray-700 text-sm">Get reminders so you never forget</span>
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-[#4A9BAF] flex-shrink-0 mt-0.5" />
            <span className="text-gray-700 text-sm">Track your progress with photos</span>
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-[#4A9BAF] flex-shrink-0 mt-0.5" />
            <span className="text-gray-700 text-sm">Get feedback from your provider</span>
          </li>
        </ul>
      </div>

      {/* Get Started in 3 Minutes */}
      <div>
        <h2 className="font-serif font-bold text-xl text-gray-900 text-center mb-6">
          Get Started in 3 Minutes
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Step 1 */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="w-8 h-8 rounded-lg bg-[#4A9BAF] text-white flex items-center justify-center font-bold text-sm mb-4">
              1
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Turn on Notifications</h3>
            <p className="text-gray-600 text-sm mb-3">
              Open your access link and allow notifications. This way you'll get reminders for your AM and PM routines.
            </p>
            <p className="text-xs text-[#CFAFA3]">
              <span className="font-medium">Tip:</span> Check your phone settings if you don't see notifications
            </p>
          </div>

          {/* Step 2 */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="w-8 h-8 rounded-lg bg-[#4A9BAF] text-white flex items-center justify-center font-bold text-sm mb-4">
              2
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Review Your Routine</h3>
            <p className="text-gray-600 text-sm mb-3">
              You'll see your AM routine, PM routine, and any weekly treatments. Read the notes from your provider—they're important!
            </p>
            <p className="text-xs text-[#B89A8E]">
              <span className="font-medium">Important:</span> Pay attention to how often to use each product
            </p>
          </div>

          {/* Step 3 */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="w-8 h-8 rounded-lg bg-[#4A9BAF] text-white flex items-center justify-center font-bold text-sm mb-4">
              3
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Take Your First Photos</h3>
            <p className="text-gray-600 text-sm mb-3">
              Upload baseline photos in good lighting. Try to keep the same angle and lighting each time—this makes it easier to see progress.
            </p>
            <div className="text-xs text-gray-500">
              <p className="font-medium mb-1">Best practices:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Clean face, no makeup</li>
                <li>Natural window light works great</li>
                <li>Front view + both side profiles</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* 3 Simple Rules for Success */}
      <div>
        <h2 className="font-serif font-bold text-xl text-gray-900 text-center mb-6">
          3 Simple Rules for Success
        </h2>
        <div className="space-y-3">
          {/* Rule 1 */}
          <div className="bg-[#F5F0ED] rounded-xl p-4 flex items-start gap-4">
            <div className="w-7 h-7 rounded-full bg-[#CFAFA3] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
              1
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm mb-1">
                Follow the plan for 7 days before changing anything
              </h3>
              <p className="text-gray-600 text-sm">
                Consistency gives us clean data. The goal is fewer variables, clearer results.
              </p>
            </div>
          </div>

          {/* Rule 2 */}
          <div className="bg-[#F5F0ED] rounded-xl p-4 flex items-start gap-4">
            <div className="w-7 h-7 rounded-full bg-[#CFAFA3] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
              2
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm mb-1">
                Don't add new products without asking first
              </h3>
              <p className="text-gray-600 text-sm">
                Even "gentle" products can interfere with your results. Message your provider before adding anything.
              </p>
            </div>
          </div>

          {/* Rule 3 */}
          <div className="bg-[#F5F0ED] rounded-xl p-4 flex items-start gap-4">
            <div className="w-7 h-7 rounded-full bg-[#CFAFA3] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
              3
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm mb-1">
                If something burns or irritates, stop and message
              </h3>
              <p className="text-gray-600 text-sm">
                Don't push through irritation. Stop the product and contact your provider right away.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* What to Expect */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <h2 className="font-serif font-bold text-lg text-gray-900 mb-2">What to Expect</h2>
        <p className="text-gray-600 text-sm mb-5">Real results take time. Here's a realistic timeline:</p>
        
        <div className="space-y-4">
          <div className="border-l-2 border-[#CFAFA3] pl-4">
            <h3 className="font-semibold text-gray-900 text-sm">Weeks 1-3:</h3>
            <p className="text-gray-600 text-sm">Your skin stabilizes, fewer flare-ups</p>
          </div>
          
          <div className="border-l-2 border-[#CFAFA3] pl-4">
            <h3 className="font-semibold text-gray-900 text-sm">Weeks 4-8:</h3>
            <p className="text-gray-600 text-sm">You start seeing texture and tone improvements</p>
          </div>
          
          <div className="border-l-2 border-[#CFAFA3] pl-4">
            <h3 className="font-semibold text-gray-900 text-sm">Weeks 8-12:</h3>
            <p className="text-gray-600 text-sm">Clear trends in hyperpigmentation, acne, or texture</p>
          </div>
        </div>

        <div className="mt-5 p-3 bg-[#F5F0ED] rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-[#B89A8E] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-600 italic">
            <span className="font-medium text-[#B89A8E]">Remember:</span> Irritation is not required for progress. In fact, irritation often slows things down.
          </p>
        </div>
      </div>

      {/* Common Questions */}
      <div>
        <h2 className="font-serif font-bold text-xl text-gray-900 text-center mb-6">
          Common Questions
        </h2>
        <div className="space-y-2">
          {FAQ_DATA.map((faq) => (
            <FAQAccordionItem
              key={faq.id}
              faq={faq}
              isExpanded={expandedFAQs.includes(faq.id)}
              onToggle={() => toggleFAQ(faq.id)}
            />
          ))}
        </div>
      </div>

      {/* Need Help? */}
      <div className="bg-gradient-to-br from-[#2D2A3E] to-[#1E1B2E] rounded-2xl p-6 text-center">
        <h2 className="font-serif font-bold text-xl text-white mb-2">Need Help?</h2>
        <p className="text-white/70 text-sm mb-5">
          Your provider is here to support you. Don't hesitate to reach out with questions or concerns.
        </p>
        <button
          onClick={handleMessageProvider}
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#4A9BAF] hover:bg-[#3A8B9F] text-white rounded-xl font-medium transition-colors"
        >
          <MessageCircle className="w-5 h-5" />
          Message Your Provider
        </button>
      </div>

      {/* Footer Disclaimer */}
      <div className="text-center px-4">
        <p className="text-xs text-gray-500">
          <span className="font-medium">Important:</span> SkinAura PRO supports your provider-guided routine. It does not replace medical advice. For urgent or severe symptoms, contact a medical professional or urgent care immediately.
        </p>
      </div>
    </div>
  );
};

export default GuideSection;
