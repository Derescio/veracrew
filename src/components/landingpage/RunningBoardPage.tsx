'use client'

import { ScrollVelocity } from "./RunningBoard";

const ROW_1 = "Cleaning Services · Construction Teams · Nursing Agencies · Staffing & Temp Agencies";
const ROW_2 = "Hospitality & Restaurant · Property Management · Event Teams · Franchise Businesses";

export default function RunningBoardPage() {
    return (
        <>
            <section id="running-board" className="grid grid-cols-1  gap-8 items-start max-w-7xl mx-auto px-6">
                {/* <div className="text-xs font-semibold uppercase tracking-widest text-brand-blue mb-3">
                    Features
                </div> */}
                <div className="font-bold text-2xl sm:text-4xl">Perfect for</div>
                <div className="w-full py-8 bg-brand-navy/90 backdrop-blur-md border-y-2 rounded-xl drop-shadow-xl">
                    <ScrollVelocity
                        texts={[ROW_1, ROW_2]}
                        velocity={20}
                        numCopies={4}
                        damping={50}
                        stiffness={400}
                        parallaxStyle={{ paddingBlock: "0.025rem" }}
                        scrollerStyle={{ fontSize: "1.75rem", fontWeight: 700, color: "#fff", letterSpacing: "-0.02em", gap: "2rem" }}
                    />
                </div>
            </section>
        </>
    );
}
