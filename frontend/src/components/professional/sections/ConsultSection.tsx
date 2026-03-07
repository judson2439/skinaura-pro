import React, { useRef, useState } from 'react';
import {
  Calendar,
  Video,
  ArrowRight,
  ChevronDown,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface ConsultSectionProps {
  onNavigateToView?: (viewId: string) => void;
}

const WORKFLOW_STEPS = [
  {
    label: '01',
    title: 'Scan',
    subtitle: 'The Consult',
    items: [
      'Client receives intake form link and completes it ahead of the session — delivered to you automatically',
      'Review intake before the consult',
      'Schedule a Live Room event from your Consult Room — set visibility to "Event attendees" and share the event link with your client',
      'Conduct live on-camera skin assessment via Circle Live Room',
    ],
    tag: 'SkinAura PRO Circle Space',
    tagVariant: 'circle' as const,
  },
  {
    label: '02',
    title: 'Plan',
    subtitle: 'Post-Consult',
    items: [
      "Update session summary in client's SkinAura PRO profile",
      'Build or update morning and evening routine',
      'Create or revise treatment plan',
      'Upload resource documents — product handouts, skin health diagrams, care guides',
    ],
    tag: 'SkinAura PRO Profile',
    tagVariant: 'pro' as const,
  },
  {
    label: '03',
    title: 'Track',
    subtitle: 'Accountability',
    items: [
      'Monitor client compliance and streaks from your dashboard',
      'Review progress photos with annotation tools',
      'Flag clients needing attention',
      'Review notes and client history in profile',
    ],
    tag: 'SkinAura PRO Dashboard',
    tagVariant: 'pro' as const,
  },
  {
    label: '04',
    title: 'Adjust',
    subtitle: 'Refine & Rebook',
    items: [
      'Send SMS nudges directly to clients',
      'Update routine or treatment plan based on progress',
      'Upload revised resource documents',
      'Schedule follow-up consult via SkinAura PRO Circle Space',
    ],
    tag: 'SkinAura PRO Profile',
    tagVariant: 'pro' as const,
  },
];

const FEATURES = [
  {
    title: 'Two-Click Consult Access',
    desc: 'Schedule a new Live Room event or jump straight into an active consult — both available from your Consult Room in the dashboard. One page, two buttons, no hunting for links.',
  },
  {
    title: 'Automated Client Intake',
    desc: "When a client completes their intake form, it's emailed directly to you — no manual follow-up, no dashboard action required. You arrive at every consult prepared.",
  },
  {
    title: 'Complete Client Profile in SkinAura PRO',
    desc: 'Session summaries, treatment plans, routines, photo annotations, notes, and resource documents all live in the client\'s SkinAura PRO profile — organized, searchable, and always accessible.',
  },
  {
    title: 'Resource Document Uploads',
    desc: 'Attach product usage handouts, printable skin health diagrams, and custom care guides directly to the client\'s profile after each consult. Professional, branded, and always on hand.',
  },
  {
    title: 'Photo Annotation Tools',
    desc: "Mark up progress photos directly in the client's profile to document changes, highlight areas of concern, and communicate visually — no third-party tools needed.",
  },
  {
    title: 'SMS Nudges & Compliance Tracking',
    desc: 'Send targeted SMS nudges from the dashboard and track client compliance, streaks, and routine adherence — so accountability never falls through the cracks between sessions.',
  },
];

const FAQ_ITEMS = [
  {
    q: 'How does my client join the consult?',
    a: "After you create a Live Room event in Circle, you'll see a direct event link. Copy that link and send it to your client via text or email — they click it, create a free Circle account on first use (less than two minutes), and they're in. For future consults, joining is immediate with no setup required. Set the event visibility to \"Event attendees\" when creating it so only your invited client can access the session.",
  },
  {
    q: 'Where does everything go after the consult?',
    a: "Everything post-consult lives in your client's SkinAura PRO profile. After each session you update the session summary, adjust their morning and evening routine, revise the treatment plan, and upload any resource documents — product handouts, skin health diagrams, care guides. The client's profile becomes their complete skin health record, updated after every interaction.",
  },
  {
    q: 'What happens with the client intake form?',
    a: "When a new client completes their intake form, it's automatically emailed directly to you — no action required on your end inside the dashboard. You'll have everything you need to review before the consult arrives in your inbox.",
  },
  {
    q: 'Why do the consult buttons open in a new tab?',
    a: "Circle.so's platform security settings don't allow their Live Rooms to be embedded directly inside external websites — this is a privacy protection built into Circle. Opening in a new tab gives you full access to your Circle event while keeping your SkinAura PRO dashboard available so you can reference client details, notes, and treatment plans during or after the consult.",
  },
  {
    q: 'Do my clients need to create a Circle account?',
    a: "Yes — it's a one-time setup that takes less than two minutes. You'll share your SkinAura PRO Circle Space invite link with the client before their first consult. They create a free Circle account, join your Space, and they're ready for the Live Room session. After that first setup, joining future consults is seamless.",
  },
  {
    q: 'Can I record my consultations?',
    a: 'Yes. Circle Live Rooms support session recording. Always inform your client before recording — obtaining consent is your responsibility. Once recorded, you can reference the session as you update the client\'s SkinAura PRO profile with your post-consult notes and care plan.',
  },
  {
    q: 'Is this HIPAA compliant? Do I need it to be?',
    a: 'If you are a licensed esthetician performing cosmetic consultations, HIPAA does not apply to your practice. HIPAA governs covered healthcare entities — physicians, insurers, and their direct partners — not estheticians. The SkinAura PRO Circle Space and skinaura.pro are fully appropriate for your client consultations. If you are a dermatologist, nurse practitioner, or medspa that prescribes treatments and handles protected health information, please contact us — we have options available for medical-tier providers.',
  },
  {
    q: "What kind of resource documents can I upload to a client's profile?",
    a: "Any document you'd hand a client in person can be uploaded directly to their SkinAura PRO profile — product usage instructions, ingredient education handouts, printable skin health diagrams, pre- and post-treatment care guides, and custom PDF protocols. Clients can access their documents anytime, and you can update or replace them as their treatment progresses.",
  },
  {
    q: 'How do SMS nudges work?',
    a: "SMS nudges are sent directly from your SkinAura PRO dashboard to individual clients. Use them to remind clients to complete their routine, acknowledge a streak milestone, prompt a check-in photo, or flag a missed day. They're a targeted accountability tool — not a broadcast, not a newsletter. Direct, personal, and effective.",
  },
];

// ============================================================================
// COMPONENT
// ============================================================================

const ConsultSection: React.FC<ConsultSectionProps> = ({ onNavigateToView }) => {
  const workflowRef = useRef<HTMLDivElement>(null);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const scrollToWorkflow = () => {
    workflowRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="max-w-[1100px] mx-auto space-y-0">
      {/* Hero */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center pb-12 lg:pb-16">
        <div>
          <div className="inline-flex items-center gap-2 bg-[#E8D5D0]/40 text-[#2D2A3E] border border-[#CFAFA3]/40 rounded-full px-3.5 py-1.5 text-xs font-medium tracking-wider uppercase mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#CFAFA3] flex-shrink-0" />
            New Feature
          </div>
          <h1 className="font-serif text-[#2D2A3E] text-4xl sm:text-[2.75rem] lg:text-5xl font-light leading-tight mb-5">
            Virtual consults, <em className="italic text-[#CFAFA3] not-italic">seamlessly connected.</em>
          </h1>
          <p className="text-lg text-[#2D2A3E]/70 font-light leading-relaxed mb-8 max-w-[460px]">
            Schedule Live Room consults and join them in one click from your SkinAura PRO dashboard. Everything after the consult — summaries, care plans, documents — stays in your client's SkinAura PRO profile where it belongs.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onNavigateToView?.('dashboard')}
              className="inline-flex items-center gap-2 bg-[#2D2A3E] text-white px-6 py-3 rounded-lg text-base font-medium transition hover:bg-[#2D2A3E]/90 hover:-translate-y-0.5"
            >
              Open My Consult Room
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={scrollToWorkflow}
              className="inline-flex items-center gap-2 bg-transparent text-[#2D2A3E] px-6 py-3 rounded-lg border border-[#CFAFA3]/30 text-base font-normal transition hover:border-[#CFAFA3] hover:-translate-y-0.5"
            >
              See the Workflow
            </button>
          </div>
        </div>

        {/* Mockup card */}
        <div className="bg-white border border-[#CFAFA3]/20 rounded-2xl shadow-[0_8px_40px_rgba(45,42,62,0.08)] overflow-hidden animate-float">
          <div className="bg-[#2D2A3E] px-4 py-3 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
            <span className="flex-1 ml-2 bg-white/10 rounded px-3 py-1 text-xs text-white/50">
              skinaura.pro/professional/consult
            </span>
          </div>
          <div className="p-6">
            <h2 className="font-serif text-2xl font-semibold text-[#2D2A3E] mb-1">Consult Room</h2>
            <p className="text-sm text-[#2D2A3E]/60 mb-5">Your virtual consultation hub</p>
            <div className="space-y-2.5">
              <a
                href="http://skinaura.circle.so/events"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3.5 bg-[#F9F7F5] border border-[#CFAFA3]/20 rounded-xl p-4 cursor-pointer transition hover:shadow-md no-underline text-inherit"
              >
                <div className="w-10 h-10 rounded-lg bg-[#E8D5D0]/50 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-5 h-5 text-[#2D2A3E]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[#2D2A3E]">Schedule a Consult</div>
                  <div className="text-xs text-[#2D2A3E]/60">Create a new Live Room event for a client</div>
                </div>
                <span className="text-[#2D2A3E]/50 text-sm">↗</span>
              </a>
              <a
                href="http://skinaura.circle.so/events"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3.5 bg-[#F9F7F5] border border-[#CFAFA3]/20 rounded-xl p-4 cursor-pointer transition hover:shadow-md no-underline text-inherit"
              >
                <div className="w-10 h-10 rounded-lg bg-[#CFAFA3]/20 flex items-center justify-center flex-shrink-0">
                  <Video className="w-5 h-5 text-[#2D2A3E]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[#2D2A3E]">Join Live Room</div>
                  <div className="text-xs text-[#2D2A3E]/60">Access your active or upcoming consults</div>
                </div>
                <span className="text-[#2D2A3E]/50 text-sm">↗</span>
              </a>
            </div>
            <p className="text-xs text-[#2D2A3E]/60 italic mt-4 leading-relaxed">
              After scheduling, copy your event link from Circle and send it directly to your client.
            </p>
          </div>
        </div>
      </div>

      {/* Workflow */}
      <section
        ref={workflowRef}
        className="bg-white border-y border-[#CFAFA3]/20 py-12 lg:py-16"
      >
        <div className="max-w-[1100px] mx-auto px-0">
          <div className="text-xs font-medium tracking-[0.15em] uppercase text-[#CFAFA3] mb-3">
            The SkinAura PRO Method
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-light text-[#2D2A3E] mb-10 lg:mb-12 leading-snug">
            Scan. Plan. Track. <em className="italic text-[#CFAFA3]">Adjust.</em>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0">
            {WORKFLOW_STEPS.map((step, i) => (
              <div
                key={step.title}
                className="p-6 lg:py-7 lg:px-6 border border-[#CFAFA3]/20 border-r-0 last:border-r border-b-0 sm:border-b last:sm:border-b bg-[#F9F7F5]/80 hover:bg-white transition lg:last:border-r"
              >
                <div className="font-serif text-2xl font-semibold text-[#CFAFA3] mb-2">
                  {step.label}
                </div>
                <div className="text-sm font-medium tracking-wider uppercase text-[#2D2A3E] mb-3">
                  {step.subtitle}
                </div>
                <ul className="space-y-1.5 list-none">
                  {step.items.map((item, j) => (
                    <li key={j} className="text-sm text-[#2D2A3E]/70 font-light leading-snug flex gap-2">
                      <span className="text-[#CFAFA3] flex-shrink-0">→</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <span
                  className={`inline-block text-xs font-medium tracking-wider uppercase px-2 py-0.5 rounded-full mt-3 ${
                    step.tagVariant === 'circle'
                      ? 'bg-[#E8D5D0]/40 text-[#2D2A3E] border border-[#CFAFA3]/40'
                      : 'bg-[#CFAFA3]/15 text-[#2D2A3E] border border-[#CFAFA3]/30'
                  }`}
                >
                  {step.tag}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-12 lg:py-16 max-w-[1100px] mx-auto">
        <div className="text-xs font-medium tracking-[0.15em] uppercase text-[#CFAFA3] mb-3">
          What's Included
        </div>
        <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-light text-[#2D2A3E] mb-9 leading-snug">
          Built for how you <em className="italic text-[#CFAFA3]">actually work.</em>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FEATURES.map((f, i) => (
            <div
              key={i}
              className="flex gap-4 items-start p-5 rounded-xl bg-white border border-[#CFAFA3]/20"
            >
              <span className="w-2 h-2 rounded-full bg-[#CFAFA3] flex-shrink-0 mt-1.5" />
              <div>
                <div className="text-base font-medium text-[#2D2A3E] mb-1">{f.title}</div>
                <div className="text-sm text-[#2D2A3E]/70 font-light leading-snug">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white border-t border-[#CFAFA3]/20 py-12 lg:py-16">
        <div className="max-w-[760px] mx-auto px-4">
          <div className="text-xs font-medium tracking-[0.15em] uppercase text-[#CFAFA3] mb-3 text-center">
            FAQ
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl font-light text-[#2D2A3E] mb-10 lg:mb-12 text-center leading-snug">
            Your questions, <em className="italic text-[#CFAFA3]">answered.</em>
          </h2>
          <div className="border-t border-[#CFAFA3]/20">
            {FAQ_ITEMS.map((faq, i) => (
              <div
                key={i}
                className="border-b border-[#CFAFA3]/20 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(openFaqIndex === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 py-5 text-left bg-transparent border-none cursor-pointer font-sans text-base font-medium text-[#2D2A3E] leading-snug hover:text-[#CFAFA3] transition"
                >
                  {faq.q}
                  <span
                    className={`flex-shrink-0 w-5 h-5 rounded-full border flex items-center justify-center text-xs transition ${
                      openFaqIndex === i
                        ? 'border-[#CFAFA3] text-[#CFAFA3] rotate-180'
                        : 'border-[#CFAFA3]/30 text-[#2D2A3E]/60'
                    }`}
                  >
                    <ChevronDown className="w-3 h-3" />
                  </span>
                </button>
                <div
                  className={`text-base text-[#2D2A3E]/70 font-light leading-relaxed overflow-hidden transition-all duration-300 ${
                    openFaqIndex === i ? 'max-h-[500px] pb-5' : 'max-h-0'
                  }`}
                >
                  <p className="whitespace-pre-line">{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default ConsultSection;
