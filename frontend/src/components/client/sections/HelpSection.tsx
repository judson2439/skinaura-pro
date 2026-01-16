import React, { useState } from 'react';
import {
  Package,
  UserPlus,
  ClipboardList,
  Bell,
  Camera,
  Settings,
  Users,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Mail,
  MessageCircle,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface HelpSectionProps {
  userRole?: 'client' | 'professional';
}

interface SOPData {
  id: number;
  title: string;
  icon: React.ReactNode;
  purpose: string;
  when: string;
  steps: string[];
  qualityStandard: string;
  maintenance?: string;
}

// ============================================================================
// SOP DATA
// ============================================================================

const SOP_DATA: SOPData[] = [
  {
    id: 1,
    title: 'Product Library Setup',
    icon: <Package className="w-5 h-5" />,
    purpose: 'Ensure routines are fast to build and tied to the products you actually sell.',
    when: 'Day 0; then weekly maintenance.',
    steps: [
      'Go to Product Library',
      'Add products in priority order: Tier 1 (Top 20 sellers), Tier 2 (Regimen essentials), Tier 3 (Specialty add-ons)',
      'For each product, confirm: Product name, Category, Usage guidance, Contraindications and cautions',
      'Save',
    ],
    qualityStandard: 'A new client routine should be buildable in under 3 minutes using the library.',
    maintenance: 'Weekly maintenance (15 minutes): Add new SKUs, Archive discontinued products, Update usage notes',
  },
  {
    id: 2,
    title: 'New Client Onboarding',
    icon: <UserPlus className="w-5 h-5" />,
    purpose: 'Move a client from an in-person appointment to at-home adherence with minimal friction.',
    when: 'For every new client and every new plan.',
    steps: [
      'Create or select the Client Profile',
      "Confirm the client's goals (acne, hyperpigmentation, sensitivity, texture, anti-aging)",
      'Assign a routine (AM, PM, and weekly treatments if applicable)',
      'Enable Notifications',
      'Set Progress Photo cadence for client uploads',
      'Send invite via email or SMS',
    ],
    qualityStandard: 'The client can access their routine, notifications are enabled, and progress photo prompts are scheduled.',
  },
  {
    id: 3,
    title: 'Build and Assign a Routine',
    icon: <ClipboardList className="w-5 h-5" />,
    purpose: 'Standardize routines so they are safe, repeatable, and easy for clients to follow.',
    when: 'When creating new client plans.',
    steps: [
      'Go to Manage Routine (the routine builder)',
      'Select products from the Product Library',
      'Build in order: Cleanse, Treat (actives), Hydrate/moisturize, Protect (SPF for AM)',
      'Add frequency guidance (daily vs. alternating nights, clear ramp-up rules for actives)',
      "Add a short client note with 'Week 1 expectations' and 'What to stop if irritation occurs'",
      'Save and assign the routine',
    ],
    qualityStandard: 'Ramp-up Rule: Week 1-2 (active 2x/week), Week 3-4 (every other night if no irritation), Pause if burning/peeling/barrier disruption occurs',
  },
  {
    id: 4,
    title: 'Notifications and Accountability Settings',
    icon: <Bell className="w-5 h-5" />,
    purpose: 'Keep clients consistent without staff chasing.',
    when: 'During client onboarding setup.',
    steps: [
      'Enable routine reminders with AM and PM reminder windows',
      'Enable Progress Photo prompts (weekly default or biweekly for sensitivity/barrier repair)',
      'If applicable, enable provider-client alerts/messaging',
      'Confirm client expectations: reminders support adherence, client uploads progress photos, provider uses uploads to give feedback',
    ],
    qualityStandard: 'Recommended cadence: Daily routine reminders (client-side), Weekly progress photo prompts (client-side upload), Provider review every 2 weeks for active-heavy routines; monthly otherwise',
  },
  {
    id: 5,
    title: 'Progress Photos and Provider Review',
    icon: <Camera className="w-5 h-5" />,
    purpose: 'Create a premium feedback loop that keeps routines aligned and reduces DIY experimenting.',
    when: 'Based on your review cadence (weekly/biweekly/monthly).',
    steps: [
      'Navigate to Progress Photos',
      'Review the latest upload vs. the baseline',
      'Add provider markup/feedback to highlight improvements, mark areas to monitor, and flag irritation patterns',
      'Leave a short action note (Continue / adjust frequency / pause actives + barrier reset / book follow-up)',
      'Save the feedback so it is visible to the client',
    ],
    qualityStandard: "Feedback Framework: What's improving, What's concerning, What we're changing (if anything), When we'll reassess",
  },
  {
    id: 6,
    title: 'Routine Adjustments Between Visits',
    icon: <Settings className="w-5 h-5" />,
    purpose: 'Make controlled changes without overwhelming clients.',
    when: 'When progress photos or client feedback indicate a need for adjustment.',
    steps: [
      'Review adherence and progress photo uploads',
      'Choose change type: frequency adjustment, swap one product, or add supportive product (barrier/SPF)',
      'Update routine',
      'Add a client note with start date and what to expect',
      'Monitor for 7-14 days before making further changes',
    ],
    qualityStandard: 'Rules: Change one variable at a time (product OR frequency OR step order). If irritation occurs: remove actives first, stabilize barrier, then reintroduce',
  },
  {
    id: 7,
    title: 'Team Delegation',
    icon: <Users className="w-5 h-5" />,
    purpose: 'Ensure routine deployment happens even when the provider is busy.',
    when: 'When scaling your practice with team members.',
    steps: [
      'Assignable Tasks: Create client profile and send invite, Confirm notifications are enabled, Set progress photo cadence, Apply saved routine templates',
      'Provider-Only Tasks: Clinical decisions, Active escalation/de-escalation, Final approval on routine changes, Markup/feedback on progress photos',
    ],
    qualityStandard: 'Clear division of responsibilities ensures efficiency while maintaining clinical oversight',
  },
];

// ============================================================================
// SOP ACCORDION ITEM
// ============================================================================

interface SOPAccordionItemProps {
  sop: SOPData;
  isExpanded: boolean;
  onToggle: () => void;
}

const SOPAccordionItem: React.FC<SOPAccordionItemProps> = ({ sop, isExpanded, onToggle }) => {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50/50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#E8F4F8] to-[#D4EBF2] flex items-center justify-center text-[#4A9BAF]">
            {sop.icon}
          </div>
          <div>
            <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-500 text-xs font-medium rounded-full mb-1">
              SOP {sop.id}
            </span>
            <h3 className="font-serif font-bold text-gray-900">{sop.title}</h3>
          </div>
        </div>
        <div className="text-gray-400">
          {isExpanded ? (
            <ChevronUp className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-5 pb-5 space-y-4 animate-in slide-in-from-top-2 duration-200">
          <div className="border-t border-gray-100 pt-4">
            {/* Purpose */}
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-[#B89A8E] mb-1">Purpose</h4>
              <p className="text-gray-600 text-sm">{sop.purpose}</p>
            </div>

            {/* When */}
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-[#B89A8E] mb-1">When</h4>
              <p className="text-gray-600 text-sm">{sop.when}</p>
            </div>

            {/* Steps */}
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-[#B89A8E] mb-2">Steps</h4>
              <ol className="space-y-2">
                {sop.steps.map((step, index) => (
                  <li key={index} className="flex gap-3 text-sm text-gray-600">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#CFAFA3]/20 text-[#CFAFA3] text-xs font-medium flex items-center justify-center">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Quality Standard */}
            <div className="p-4 bg-[#CFAFA3]/10 rounded-xl">
              <h4 className="text-sm font-semibold text-[#B89A8E] mb-1">Quality Standard</h4>
              <p className="text-gray-600 text-sm">{sop.qualityStandard}</p>
            </div>

            {/* Maintenance (if exists) */}
            {sop.maintenance && (
              <div className="mt-3 p-4 bg-[#CFAFA3]/10 rounded-xl">
                <h4 className="text-sm font-semibold text-[#B89A8E] mb-1">Maintenance</h4>
                <p className="text-gray-600 text-sm">{sop.maintenance}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const HelpSection: React.FC<HelpSectionProps> = ({ userRole = 'client' }) => {
  const [expandedSOPs, setExpandedSOPs] = useState<number[]>([1]);
  const isProfessional = userRole === 'professional';

  const toggleSOP = (sopId: number) => {
    setExpandedSOPs((prev) =>
      prev.includes(sopId) ? prev.filter((id) => id !== sopId) : [...prev, sopId]
    );
  };

  const expandAll = () => {
    setExpandedSOPs(SOP_DATA.map((sop) => sop.id));
  };

  const collapseAll = () => {
    setExpandedSOPs([]);
  };

  return (
    <div className="space-y-6">
      {/* Two-column layout: SOP and Help & FAQ side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Column: SOPs Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-serif font-bold text-gray-900">Standard Operating Procedures</h2>
              <p className="text-gray-500 text-sm mt-1">
                Follow these guidelines for consistent and efficient operations
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={expandAll}
                className="px-3 py-1.5 text-sm text-[#CFAFA3] hover:bg-[#CFAFA3]/10 rounded-lg transition-colors"
              >
                Expand All
              </button>
              <button
                onClick={collapseAll}
                className="px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Collapse All
              </button>
            </div>
          </div>

          {/* SOP Accordions */}
          <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
            {SOP_DATA.map((sop) => (
              <SOPAccordionItem
                key={sop.id}
                sop={sop}
                isExpanded={expandedSOPs.includes(sop.id)}
                onToggle={() => toggleSOP(sop.id)}
              />
            ))}
          </div>
        </div>

        {/* Right Column: Help & FAQ Section */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#CFAFA3]/20 to-[#B89A8E]/20 flex items-center justify-center">
              <HelpCircle className="w-5 h-5 text-[#CFAFA3]" />
            </div>
            <h2 className="text-2xl font-serif font-bold text-gray-900">Help & FAQ</h2>
          </div>

          <div className="space-y-4 max-h-[calc(100vh-280px)] overflow-y-auto pr-2">
            <div className="p-4 bg-gray-50 rounded-xl">
              <h3 className="font-medium text-gray-900 mb-2">What is SkinAura PRO?</h3>
              <p className="text-gray-600 text-sm">
                SkinAura PRO is a professional skincare tracking platform designed for estheticians and their clients.
                It helps track skincare routines, manage products, analyze progress photos, and monitor client compliance.
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl">
              <h3 className="font-medium text-gray-900 mb-2">How do I track my routine?</h3>
              <p className="text-gray-600 text-sm">
                Simply mark your morning and evening routines as complete each day.
                You'll earn points and build streaks for consistency!
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl">
              <h3 className="font-medium text-gray-900 mb-2">How does the gamification work?</h3>
              <p className="text-gray-600 text-sm">
                Complete routines to earn 50 points each, with bonus points for maintaining streaks.
                Progress through Bronze, Silver, Gold, Platinum, and Diamond levels.
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl">
              <h3 className="font-medium text-gray-900 mb-2">Can I upload progress photos?</h3>
              <p className="text-gray-600 text-sm">
                Yes! Upload before, after, and progress photos to track your skincare journey.
                Your professional can view and provide feedback on these photos.
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl">
              <h3 className="font-medium text-gray-900 mb-2">How do streaks work?</h3>
              <p className="text-gray-600 text-sm">
                A streak represents consecutive days where you've completed at least one skincare routine.
                Missing a day will reset your streak, so try to be consistent!
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl">
              <h3 className="font-medium text-gray-900 mb-2">How do I earn badges?</h3>
              <p className="text-gray-600 text-sm">
                Badges are earned by completing various achievements like maintaining streaks,
                uploading progress photos, adding products, and reaching certain milestones in your skincare journey.
              </p>
            </div>

            {isProfessional && (
              <>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <h3 className="font-medium text-gray-900 mb-2">How do I add clients?</h3>
                  <p className="text-gray-600 text-sm">
                    Go to "My Clients" and click "Add Client". Enter your client's email address -
                    they must have already signed up as a client on SkinAura PRO.
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl">
                  <h3 className="font-medium text-gray-900 mb-2">How do I create routines for clients?</h3>
                  <p className="text-gray-600 text-sm">
                    Go to "Manage Routines" to create routine templates. Add steps with products and instructions,
                    then assign the routine to specific clients.
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl">
                  <h3 className="font-medium text-gray-900 mb-2">How do I send reminders to clients?</h3>
                  <p className="text-gray-600 text-sm">
                    From the client's profile or the compliance dashboard, click "Send Reminder" to send an SMS reminder.
                    You'll need to have Twilio integration configured in your settings.
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl">
                  <h3 className="font-medium text-gray-900 mb-2">How do I annotate progress photos?</h3>
                  <p className="text-gray-600 text-sm">
                    View a client's progress photo and click "Add Markup". Use the drawing tools to highlight areas
                    of concern or improvement, then save your annotations for the client to see.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Contact Support */}
      <div className="bg-gradient-to-r from-[#CFAFA3]/10 to-white rounded-2xl p-6 border border-[#CFAFA3]/20">
        <h3 className="font-serif font-bold text-lg text-gray-900 mb-2">Need More Help?</h3>
        <p className="text-gray-600 text-sm mb-4">
          Can't find what you're looking for? Our support team is here to help.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href="mailto:support@skinaura.ai"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:border-[#CFAFA3] hover:text-[#CFAFA3] transition-colors"
          >
            <Mail className="w-4 h-4" />
            Email Support
          </a>
          <a
            href="https://skinaura.circle.so/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#CFAFA3] to-[#B89A8E] text-white rounded-xl text-sm font-medium hover:shadow-lg transition-all"
          >
            <MessageCircle className="w-4 h-4" />
            Join Community
          </a>
        </div>
      </div>
    </div>
  );
};

export default HelpSection;
