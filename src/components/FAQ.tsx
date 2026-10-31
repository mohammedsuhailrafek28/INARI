import React, { useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import { Section } from './ui/Section';
import { MOCK_FAQS } from '../data/mock';

export const FAQ: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <Section id="faq" canvas="dark" className="border-t border-border-dark">
      {/* Eyebrow */}
      <div className="flex items-center gap-3 font-mono text-xs md:text-sm tracking-wideMono uppercase text-ink-mutedLight mb-6">
        <span className="w-2.5 h-2.5 bg-thread" />
        <span>05 // FREQUENTLY ANSWERED INQUIRIES</span>
      </div>

      {/* Mammoth Headline */}
      <div className="max-w-4xl mb-16 md:mb-20">
        <h2 className="font-archivo font-[800] text-3xl sm:text-5xl md:text-6xl lg:text-7xl leading-[0.9] tracking-tightest uppercase text-ink-light">
          QUESTIONS <br />
          ABOUT THE MODEL.
        </h2>
        <p className="mt-6 font-sans text-lg sm:text-xl text-ink-mutedLight max-w-2xl leading-relaxed">
          Clear answers about how INARI handles your bank statements, calculates deterministic runways, and safeguards your financial autonomy.
        </p>
      </div>

      {/* Accordion List */}
      <div className="max-w-4xl border-t border-border-dark">
        {MOCK_FAQS.map((faq, index) => {
          const isOpen = openIndex === index;
          return (
            <div key={index} className="border-b border-border-dark">
              <button
                type="button"
                onClick={() => toggle(index)}
                className="w-full py-6 md:py-8 flex items-center justify-between text-left group focus:outline-none focus:ring-1 focus:ring-thread"
                aria-expanded={isOpen}
              >
                <span className="font-archivo font-bold text-lg sm:text-xl md:text-2xl text-ink-light uppercase tracking-tight group-hover:text-thread transition-colors pr-6">
                  {faq.question}
                </span>
                <span className="p-2 border border-border-dark text-ink-mutedLight group-hover:border-thread group-hover:text-thread transition-colors flex-shrink-0">
                  {isOpen ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </span>
              </button>

              {isOpen && (
                <div className="pb-8 font-sans text-base sm:text-lg text-ink-mutedLight leading-relaxed pr-6 max-w-3xl animate-in fade-in duration-200">
                  {faq.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
};

