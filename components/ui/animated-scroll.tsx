import React, { useState, useEffect, useRef } from 'react';
import { Mail, Phone, MapPin, Linkedin, ChevronDown, ChevronUp, Award, BookOpen, Briefcase } from 'lucide-react';
import { Timeline } from './timeline';
import { HeroParallax } from './hero-parallax';

// Data definition for the portfolio
const pages = [
  {
    // Page 1: Header / Intro
    id: 'intro',
    type: 'split',
    // PRIMARY IMAGE: Points to local file. Fallback handles load errors.
    leftBgImage: '/vs-autumn.jpg',
    rightBgImage: null,
    leftContent: null,
    rightContent: {
      heading: 'Vambah Sillah',
      description: (
        <div className="space-y-6">
            <div className="text-xl md:text-2xl font-light text-slate-300">Director of Product Strategy at a Fortune 500 Company, AI Automations specialist, Author, Hip Hop Artist, and Co-Founder of AmaduTown Advisory Solutions.</div>
            <hr className="border-slate-600 w-24 mx-auto" />
            <div className="flex flex-col items-center gap-3 text-sm md:text-base text-slate-400">
                <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <span>22 Vassar Street, Medford, MA 02155</span>
                </div>
                <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    <span>vsillah@gmail.com</span>
                </div>
                <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    <span>617-967-7448</span>
                </div>
            </div>
            <div className="pt-8 animate-bounce text-slate-500 text-xs uppercase tracking-widest">
                Scroll to Explore
            </div>
        </div>
      ),
    },
  },
  {
    // Page 2: Overview
    id: 'overview',
    type: 'split',
    leftBgImage: null,
    rightBgImage: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=900&auto=format&fit=crop&q=80',
    leftContent: {
      heading: 'Overview',
      description: (
        <div className="max-w-md mx-auto text-left space-y-4 text-slate-300 leading-relaxed text-sm md:text-base">
            <p>IT Product Manager with a proven track record of applying agile methodology to continuously evolve products to delight customers.</p>
            <ul className="list-disc pl-5 space-y-2">
                <li>Skilled facilitator with a passion for inspiring teams to deliver innovative solutions.</li>
                <li>Excellent analytical skills with demonstrated ability to transform qualitative and quantitative data into actionable insights.</li>
                <li>Entrepreneurial mindset with a bias for customer focused innovation.</li>
                <li>Managerial experience designing professional development programs to elevate associates’ skillsets.</li>
                <li>Demonstrated ability to identify market opportunities, plan strategic initiatives, and execute towards established objectives.</li>
            </ul>
        </div>
      ),
    },
    rightContent: null,
  },
  {
    // Page 3: Fidelity Institutional
    id: 'exp1',
    type: 'split',
    leftBgImage: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=900&auto=format&fit=crop&q=80',
    rightBgImage: null,
    leftContent: null,
    rightContent: {
      heading: 'Experience',
      description: (
        <div className="text-left max-w-lg mx-auto">
            <div className="mb-6">
                <h3 className="text-xl font-bold text-white">Fidelity Investments, Fidelity Institutional</h3>
                <p className="text-emerald-400 font-semibold">Director of Product Management</p>
                <p className="text-slate-500 text-sm mb-4">Boston, MA | Jan 2024 – Present</p>
            </div>
            <ul className="list-disc pl-5 space-y-3 text-slate-300 text-sm md:text-base">
                <li>Conducted market analysis and developed business case frameworks to assess the viability of new offerings.</li>
                <li>Established cooperative partnerships with Product Area Leaders and consulted with subject matter experts across Finance, Market Research, and Strategy.</li>
                <li>Synthesized "voice of the client" inputs and developed client segmentation frameworks to inform adoption and delivery strategies.</li>
                <li>Facilitated capability sizing sessions and collaborated with senior leadership to articulate strategic outputs.</li>
            </ul>
        </div>
      ),
    },
  },
  {
    // Page 4: Fidelity PI - Digital PO
    id: 'exp2',
    type: 'split',
    leftBgImage: null,
    rightBgImage: 'https://images.unsplash.com/photo-1553877615-30c7309dc584?w=900&auto=format&fit=crop&q=80',
    leftContent: {
        heading: 'Digital Product Owner',
        description: (
          <div className="text-left max-w-lg mx-auto">
              <div className="mb-6">
                  <h3 className="text-xl font-bold text-white">Fidelity Investments, Personal Investing</h3>
                  <p className="text-emerald-400 font-semibold">Merrimack, NH | August 2016 – April 2018</p>
              </div>
              <ul className="list-disc pl-5 space-y-3 text-slate-300 text-sm md:text-base">
                  <li>Leveraged customer insights to develop an event-driven notification platform to digitize the “awareness” stage of the customer journey.</li>
                  <li>Utilized SiteCatalyst, ClickTale, and OpinionLab to identify unmet customer need, driving backlog prioritization and maximizing value.</li>
                  <li>Designed and facilitated an organization-wide workshop to identify and build consensus for customer-driven inputs to influence backlog prioritization.</li>
              </ul>
          </div>
        ),
    },
    rightContent: null,
  },
  {
    // Page 5: Fidelity PI - BA Lead
    id: 'exp3',
    type: 'split',
    leftBgImage: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=900&auto=format&fit=crop&q=80',
    rightBgImage: null,
    leftContent: null,
    rightContent: {
        heading: 'BA Team Lead & Product Owner',
        description: (
          <div className="text-left max-w-lg mx-auto">
              <div className="mb-6">
                  <h3 className="text-xl font-bold text-white">Fidelity Investments, Personal Investing</h3>
                  <p className="text-emerald-400 font-semibold">Boston, MA | June 2015 – August 2016</p>
              </div>
              <ul className="list-disc pl-5 space-y-3 text-slate-300 text-sm md:text-base">
                  <li>Digitized product offerings within existing digital ecosystem (ABLE accounts, TEM plans), creating $102M in inflows.</li>
                  <li>Developed “BA in a Box” to assist Ship It Day Teams, streamlining release planning.</li>
                  <li>Implemented process to reduce acceptance test window of new enhancements from 3 days to 1 hour.</li>
                  <li>Led a 5-member BA team in instituting best practices for requirement gathering, resulting in a 30% faster time to market.</li>
              </ul>
          </div>
        ),
    },
  },
  {
    // Page 6: Previous Roles
    id: 'exp_prev',
    type: 'split',
    leftBgImage: null,
    rightBgImage: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=900&auto=format&fit=crop&q=80',
    leftContent: {
        heading: 'Early Career',
        description: (
          <div className="text-left max-w-lg mx-auto space-y-8">
              <div>
                  <h3 className="text-lg font-bold text-white">Senior Business Analyst</h3>
                  <p className="text-slate-500 text-xs mb-2">Fidelity Investments, Personal Investing | Dec 2014 – June 2015</p>
                  <ul className="list-disc pl-5 text-slate-300 text-sm">
                      <li>Consolidated customer metrics to provide holistic feedback along the customer journey.</li>
                      <li>Winner of the 2015 Excellence Award for outstanding teamwork.</li>
                  </ul>
              </div>
              <div>
                  <h3 className="text-lg font-bold text-white">Business Analyst</h3>
                  <p className="text-slate-500 text-xs mb-2">Fidelity Investments, Asset Management | Aug 2012 – Dec 2014</p>
                  <ul className="list-disc pl-5 text-slate-300 text-sm">
                      <li>Led an offshore team to deliver a digital experience for distributing research analyst reports.</li>
                      <li>Documented objectives, use cases, and data specifications.</li>
                  </ul>
              </div>
          </div>
        ),
    },
    rightContent: null,
  },
  {
    // Page 7: Skills & Education
    id: 'skills',
    type: 'split',
    leftBgImage: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=900&auto=format&fit=crop&q=80',
    rightBgImage: null,
    leftContent: null,
    rightContent: {
      heading: 'Skills & Education',
      description: (
        <div className="text-left w-full max-w-lg mx-auto space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                    <div className="flex items-center gap-2 mb-2 text-emerald-400">
                        <Briefcase size={16} />
                        <h4 className="font-bold text-sm uppercase">Technical</h4>
                    </div>
                    <p className="text-xs text-slate-300">SQL, Python, Visio, Adobe SiteCatalyst, Splunk, Generative AI Tools</p>
                </div>
                <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                    <div className="flex items-center gap-2 mb-2 text-emerald-400">
                        <Award size={16} />
                        <h4 className="font-bold text-sm uppercase">Leadership</h4>
                    </div>
                    <p className="text-xs text-slate-300">Strategic Planning, Facilitation, People management, Change Management</p>
                </div>
                <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                    <div className="flex items-center gap-2 mb-2 text-emerald-400">
                        <BookOpen size={16} />
                        <h4 className="font-bold text-sm uppercase">Education</h4>
                    </div>
                     <p className="text-xs text-slate-300"><strong>BS Business Administration</strong><br/>Boston University, 2008</p>
                </div>
                <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                    <div className="flex items-center gap-2 mb-2 text-emerald-400">
                        <Award size={16} />
                        <h4 className="font-bold text-sm uppercase">Certifications</h4>
                    </div>
                    <p className="text-xs text-slate-300">Certified Scrum Master (2014)<br/>Certified Product Owner (2014)</p>
                </div>
            </div>
            <div className="text-xs text-slate-400 italic text-center pt-4">
                Personal: Spanish (conversational), chess, mountain biking, obstacle course racing
            </div>
        </div>
      ),
    },
  },
  {
    // Page 8: Detailed Timeline
    id: 'timeline',
    type: 'full',
    leftBgImage: null,
    rightBgImage: null,
    leftContent: null,
    rightContent: null
  },
  {
    // Page 9: Projects Parallax
    id: 'projects',
    type: 'parallax',
    leftBgImage: null,
    rightBgImage: null,
    leftContent: null,
    rightContent: null
  }
];

const timelineData = [
    {
      title: "2024",
      content: (
        <div>
          <h4 className="text-emerald-400 font-bold text-lg">Director of Product Management</h4>
          <p className="text-slate-500 text-sm mb-4">Fidelity Investments | Jan 2024 - Present</p>
          <div className="mb-6 text-slate-300 text-sm space-y-2">
            <p>Leading strategic initiatives and product evolution.</p>
            <ul className="list-disc pl-4 space-y-2">
                <li>Conducted market analysis and developed business case frameworks to assess viability of new offerings.</li>
                <li>Synthesized "voice of the client" inputs to develop client segmentation frameworks.</li>
                <li>Partnered with procurement teams for vendor analysis and cost-benefit models.</li>
                <li>Designed and executed a squad lead cohort training program, empowering 15 squad leaders.</li>
            </ul>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <img 
                src="https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&auto=format&fit=crop&q=60" 
                className="rounded-lg object-cover h-32 w-full border border-slate-800"
                alt="Strategic Meeting"
             />
             <img 
                src="/vs-autumn.jpg"
                className="rounded-lg object-cover h-32 w-full border border-slate-800"
                alt="Vambah Sillah"
                onError={(e) => {
                  // Fallback if local image not found - use abstract pattern instead of wrong person
                  console.warn("Local image /vs-autumn.jpg not found, using fallback.");
                  e.currentTarget.src = "https://images.unsplash.com/photo-1557683316-973673baf926?w=600&auto=format&fit=crop&q=60";
                  e.currentTarget.onerror = null;
                }}
             />
          </div>
        </div>
      ),
    },
    {
      title: "2018-2022",
      content: (
        <div>
          <h4 className="text-emerald-400 font-bold text-lg">Product Manager</h4>
          <p className="text-slate-500 text-sm mb-4">Fidelity Investments | Apr 2018 - Jan 2022</p>
          <div className="mb-6 text-slate-300 text-sm space-y-2">
            <ul className="list-disc pl-4 space-y-2">
                <li>Led delivery of a reusable error handling platform, addressing 10% of raised defects.</li>
                <li>Simplified complex client configurations with new data flow diagrams.</li>
                <li>Established a professional development forum for subject matter experts.</li>
                <li>Identified 22% of team's enhancements through incident management reporting.</li>
            </ul>
          </div>
          <img 
                src="https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&auto=format&fit=crop&q=60" 
                className="rounded-lg object-cover h-40 w-full border border-slate-800"
                alt="Team Collaboration"
             />
        </div>
      ),
    },
    {
      title: "2016-2018",
      content: (
        <div>
          <h4 className="text-emerald-400 font-bold text-lg">Product Owner</h4>
          <p className="text-slate-500 text-sm mb-4">Fidelity Investments | Aug 2016 - Apr 2018</p>
          <div className="mb-6 text-slate-300 text-sm space-y-2">
            <ul className="list-disc pl-4 space-y-2">
                <li>Developed event-driven notification platform to digitize customer awareness.</li>
                <li>Partnered with Salesforce Marketing Cloud for on-demand notifications.</li>
                <li>Produced informative music video describing new operating model (1.5k+ views).</li>
                <li>Accolades: 2017 ShipIt Day award finalist.</li>
            </ul>
          </div>
        </div>
      ),
    },
    {
        title: "2015-2016",
        content: (
          <div>
            <h4 className="text-emerald-400 font-bold text-lg">Business Analyst Team Lead</h4>
            <p className="text-slate-500 text-sm mb-4">Fidelity Investments | Jun 2015 - Aug 2016</p>
            <div className="mb-6 text-slate-300 text-sm space-y-2">
              <ul className="list-disc pl-4 space-y-2">
                  <li>Managed offshore team to integrate 401k and retail plans, driving $102M in inflows.</li>
                  <li>Reduced acceptance test window from 3 days to 1 hour.</li>
                  <li>Instituted requirements gathering best practices, improving time to market by 30%.</li>
              </ul>
            </div>
          </div>
        ),
    },
    {
        title: "2014-2015",
        content: (
          <div>
            <h4 className="text-emerald-400 font-bold text-lg">Senior Business Analyst</h4>
            <p className="text-slate-500 text-sm mb-4">Fidelity Investments | Dec 2014 - Jun 2015</p>
            <div className="mb-6 text-slate-300 text-sm space-y-2">
              <ul className="list-disc pl-4 space-y-2">
                  <li>Winner of 2015 Excellence Award for digitizing research report distribution.</li>
                  <li>Created complex logical data models and metadata business rules.</li>
              </ul>
            </div>
          </div>
        ),
    },
    {
        title: "2012-2014",
        content: (
          <div>
            <h4 className="text-emerald-400 font-bold text-lg">Business Analyst</h4>
            <p className="text-slate-500 text-sm mb-4">Fidelity Investments | Jul 2012 - Dec 2014</p>
            <div className="mb-6 text-slate-300 text-sm space-y-2">
              <ul className="list-disc pl-4 space-y-2">
                  <li>Led offshore team for digital research report distribution.</li>
                  <li>Evaluated existing data designs for capability and performance.</li>
              </ul>
            </div>
          </div>
        ),
    },
    {
        title: "2011-2012",
        content: (
          <div>
            <h4 className="text-emerald-400 font-bold text-lg">Team Leader</h4>
            <p className="text-slate-500 text-sm mb-4">Fidelity Investments | Jul 2011 - Jul 2012</p>
            <div className="mb-6 text-slate-300 text-sm space-y-2">
              <ul className="list-disc pl-4 space-y-2">
                  <li>Led 8-member admin team supporting technology group.</li>
                  <li>Built streamlined end-to-end travel approval process in Sharepoint.</li>
              </ul>
            </div>
          </div>
        ),
    }
];

const productsData = [
  {
    title: "Achiever's Network Flash Consulting",
    link: "#",
    thumbnail: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&auto=format&fit=crop&q=60",
    description: "Enhanced online presence and made website conversion-friendly. Increased awareness on social media platforms."
  },
  {
    title: "Crossover Project",
    link: "#",
    thumbnail: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&auto=format&fit=crop&q=60",
    description: "Fidelity Investments strategic initiative."
  },
  {
    title: "Counterparty NGR Project",
    link: "#",
    thumbnail: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=60",
    description: "Project focused on risk and counterparty data management."
  },
  {
    title: "CRS/Research Browser",
    link: "#",
    thumbnail: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=60",
    description: "Event Notification Project. Digitized research report distribution."
  },
  {
    title: "Portfolio Summary Project",
    link: "#",
    thumbnail: "https://images.unsplash.com/photo-1611974765270-ca1258634369?w=800&auto=format&fit=crop&q=60",
    description: "Fidelity.com Portfolio Summary enhancement and modernization."
  },
  {
    title: "Proactive Notification",
    link: "#",
    thumbnail: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=60",
    description: "PI Project to digitize the 'awareness' stage of customer journey."
  },
  {
    title: "Error Handling Platform",
    link: "#",
    thumbnail: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=60",
    description: "Reusable platform addressing 10% of raised defects across suite."
  },
  {
    title: "Digital Onboarding",
    link: "#",
    thumbnail: "https://images.unsplash.com/photo-1586717791821-3f44a5638d48?w=800&auto=format&fit=crop&q=60",
    description: "Streamlined client onboarding via simplified data flows."
  },
  {
    title: "Professional Dev Forum",
    link: "#",
    thumbnail: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=800&auto=format&fit=crop&q=60",
    description: "Professional development forum for subject matter experts."
  },
  {
    title: "Agile Transformation",
    link: "#",
    thumbnail: "https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=800&auto=format&fit=crop&q=60",
    description: "Adoption of Agile principles and 'BA in a Box' development."
  },
  {
    title: "Beta Delivery Platform",
    link: "#",
    thumbnail: "https://images.unsplash.com/photo-1517976487492-5750f3195933?w=800&auto=format&fit=crop&q=60",
    description: "Safely expose customers to experimental products."
  },
  {
    title: "Customer Insights",
    link: "#",
    thumbnail: "https://images.unsplash.com/photo-1533750349088-cd8773a98e4e?w=800&auto=format&fit=crop&q=60",
    description: "Voice of the Client synthesis and segmentation frameworks."
  },
  {
    title: "Legal Review Workflow",
    link: "#",
    thumbnail: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&auto=format&fit=crop&q=60",
    description: "Scaled best practices working model across the organization."
  },
  {
    title: "Workplace 401k Integration",
    link: "#",
    thumbnail: "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=800&auto=format&fit=crop&q=60",
    description: "Integrated digital platform for workplace and retail plans."
  },
  {
    title: "Admin Pool Program",
    link: "#",
    thumbnail: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop&q=60",
    description: "Job share program to streamline existing workload processes."
  },
];


export default function ScrollAdventure() {
  const [currentPage, setCurrentPage] = useState(1);
  const numOfPages = pages.length;
  const animTime = 1000;
  const scrolling = useRef(false);
  const fullPageScrollRef = useRef<HTMLDivElement>(null);

  const navigateUp = () => {
    if (currentPage > 1) setCurrentPage(p => p - 1);
  };

  const navigateDown = () => {
    if (currentPage < numOfPages) setCurrentPage(p => p + 1);
  };

  const handleWheel = (e: WheelEvent) => {
    if (scrolling.current) return;
    // Add a small threshold to prevent accidental micro-scrolls
    if (Math.abs(e.deltaY) < 20) return;

    const currentPageType = pages[currentPage - 1].type;

    // Special handling for Full Scroll Pages (Timeline & Parallax)
    if ((currentPageType === 'full' || currentPageType === 'parallax') && fullPageScrollRef.current) {
        const el = fullPageScrollRef.current;
        const isScrollingDown = e.deltaY > 0;
        const isScrollingUp = e.deltaY < 0;
        
        // If we are not at the bottom and scrolling down, let native scroll happen
        if (isScrollingDown && el.scrollTop + el.clientHeight < el.scrollHeight - 5) {
            return; 
        }
        
        // If we are not at the top and scrolling up, let native scroll happen
        if (isScrollingUp && el.scrollTop > 5) {
            return;
        }

        // If at top and scrolling up, navigate to previous page
        if (isScrollingUp && el.scrollTop <= 5) {
             scrolling.current = true;
             navigateUp();
             setTimeout(() => (scrolling.current = false), animTime);
             return;
        }
        
        // If at bottom and scrolling down
        if (isScrollingDown) {
             if(currentPage < numOfPages) {
                scrolling.current = true;
                navigateDown();
                setTimeout(() => (scrolling.current = false), animTime);
             }
             return;
        }
    }
    
    scrolling.current = true;
    e.deltaY > 0 ? navigateDown() : navigateUp();
    setTimeout(() => (scrolling.current = false), animTime);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (scrolling.current) return;
    const currentPageType = pages[currentPage - 1].type;
    
    if (currentPageType === 'full' || currentPageType === 'parallax') return;

    if (e.key === 'ArrowUp') {
      scrolling.current = true;
      navigateUp();
      setTimeout(() => (scrolling.current = false), animTime);
    } else if (e.key === 'ArrowDown') {
      scrolling.current = true;
      navigateDown();
      setTimeout(() => (scrolling.current = false), animTime);
    }
  };

  useEffect(() => {
    window.addEventListener('wheel', handleWheel);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentPage]);

  // Touch support for mobile
  const touchStartY = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => {
      touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
      if (scrolling.current) return;
      
      const currentPageType = pages[currentPage - 1].type;

      // Allow touch scroll in full pages without navigating immediately
      if ((currentPageType === 'full' || currentPageType === 'parallax') && fullPageScrollRef.current) {
          // Simple check: if we are in timeline, don't swipe-nav unless strictly at top
          if (fullPageScrollRef.current.scrollTop > 5) return;
      }

      const touchEndY = e.changedTouches[0].clientY;
      const diff = touchStartY.current - touchEndY;
      
      if (Math.abs(diff) > 50) { // Threshold
          scrolling.current = true;
          diff > 0 ? navigateDown() : navigateUp();
          setTimeout(() => (scrolling.current = false), animTime);
      }
  };

  return (
    <div 
        className="relative overflow-hidden h-screen bg-slate-950 text-slate-100 font-sans"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
    >
      {/* Navigation Indicators */}
      <div className="absolute right-4 top-1/2 transform -translate-y-1/2 z-50 hidden md:flex flex-col gap-2">
        {pages.map((_, i) => (
            <button 
                key={i}
                onClick={() => {
                    if(!scrolling.current && currentPage !== i + 1) {
                        setCurrentPage(i + 1);
                    }
                }}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${currentPage === i + 1 ? 'bg-emerald-500 scale-125' : 'bg-slate-700 hover:bg-slate-500'}`}
            />
        ))}
      </div>

      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-50 md:hidden flex gap-2">
         {pages.map((_, i) => (
            <div 
                key={i}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${currentPage === i + 1 ? 'bg-emerald-500' : 'bg-slate-700'}`}
            />
        ))}
      </div>

      {pages.map((page, i) => {
        const idx = i + 1;
        const isActive = currentPage === idx;
        
        // Common Transitions
        const upOff = 'translateY(-100%)';
        const downOff = 'translateY(100%)';
        
        // FULL PAGE COMPONENT (Timeline)
        if (page.type === 'full') {
             return (
                 <div 
                    key={page.id} 
                    className="absolute inset-0 bg-slate-950 transition-transform duration-[1000ms] ease-in-out z-20"
                    style={{ transform: isActive ? 'translateY(0)' : (idx > currentPage ? downOff : upOff) }}
                 >
                    {/* Scrollable Container for Timeline */}
                    <div 
                        ref={isActive ? fullPageScrollRef : null}
                        className="w-full h-full overflow-y-auto scroll-smooth relative"
                    >
                         <Timeline data={timelineData} scrollContainerRef={fullPageScrollRef} />
                         <div className="h-20 w-full flex items-center justify-center text-slate-600 text-sm">
                             Scroll for more
                         </div>
                    </div>
                 </div>
             )
        }
        
        // PARALLAX COMPONENT
        if (page.type === 'parallax') {
            return (
                <div 
                   key={page.id} 
                   className="absolute inset-0 bg-slate-950 transition-transform duration-[1000ms] ease-in-out z-20"
                   style={{ transform: isActive ? 'translateY(0)' : (idx > currentPage ? downOff : upOff) }}
                >
                   {/* Scrollable Container for Parallax */}
                   <div 
                       ref={isActive ? fullPageScrollRef : null}
                       className="w-full h-full overflow-y-auto scroll-smooth relative"
                   >
                        <HeroParallax products={productsData} scrollContainerRef={fullPageScrollRef} />
                        <div className="h-20 w-full flex items-center justify-center text-slate-600 text-sm">
                             End of Portfolio
                        </div>
                   </div>
                </div>
            )
       }

        // SPLIT SCREEN COMPONENT
        const leftTrans = isActive ? 'translateY(0)' : downOff;
        const rightTrans = isActive ? 'translateY(0)' : upOff;

        return (
          <div key={page.id} className="absolute inset-0 pointer-events-none">
            
            {/* LEFT PANEL (Top on Mobile) */}
            <div
              className="absolute top-0 left-0 w-full h-1/2 md:h-full md:w-1/2 transition-transform duration-[1000ms] ease-in-out z-10"
              style={{ 
                  transform: window.innerWidth >= 768 ? leftTrans : (isActive ? 'translateY(0)' : 'translateY(-100%)') 
              }}
            >
              <div className="w-full h-full relative border-b md:border-b-0 md:border-r border-slate-800/50 bg-slate-900 overflow-hidden">
                 {/* BG Image with Error Fallback */}
                 {page.leftBgImage && (
                    <img 
                        src={page.leftBgImage}
                        alt="Background"
                        className="absolute inset-0 w-full h-full object-cover"
                        onError={(e) => {
                            console.warn("Local image load failed, switching to fallback.");
                            // Fallback to abstract pattern if local image fails - NO WRONG PERSON
                            e.currentTarget.src = "https://images.unsplash.com/photo-1557683316-973673baf926?w=900&auto=format&fit=crop&q=80";
                            e.currentTarget.onerror = null;
                        }}
                    />
                 )}
                 
                 {/* Overlay */}
                 <div className={`absolute inset-0 ${page.leftBgImage ? 'bg-slate-950/40 backdrop-blur-[1px]' : 'bg-slate-900'}`}></div>

                <div className="relative flex flex-col items-center justify-center h-full text-white p-6 md:p-12 pointer-events-auto overflow-y-auto no-scrollbar">
                  {page.leftContent && (
                    <div className="w-full max-w-xl animate-fade-in">
                      <h2 className={`text-2xl md:text-4xl font-bold uppercase mb-6 tracking-tight text-emerald-400 ${page.id === 'intro' ? 'text-center' : 'text-center md:text-left'}`}>
                        {page.leftContent.heading}
                      </h2>
                      <div className={`text-base md:text-lg font-light ${page.id === 'intro' ? 'text-center' : 'text-center md:text-left'}`}>
                        {page.leftContent.description}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT PANEL (Bottom on Mobile) */}
            <div
              className="absolute top-1/2 left-0 md:top-0 md:left-1/2 w-full h-1/2 md:h-full md:w-1/2 transition-transform duration-[1000ms] ease-in-out z-10"
              style={{ 
                   transform: window.innerWidth >= 768 ? rightTrans : (isActive ? 'translateY(0)' : 'translateY(100%)')
              }}
            >
              <div className="w-full h-full relative bg-slate-800 overflow-hidden">
                
                 {/* BG Image with Error Fallback */}
                 {page.rightBgImage && (
                    <img 
                        src={page.rightBgImage}
                        alt="Background"
                        className="absolute inset-0 w-full h-full object-cover"
                        onError={(e) => {
                            // Generic fallback
                            e.currentTarget.src = "https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=900&auto=format&fit=crop&q=80";
                            e.currentTarget.onerror = null;
                        }}
                    />
                 )}
                 
                 {/* Overlay */}
                 <div className={`absolute inset-0 ${page.rightBgImage ? 'bg-slate-950/40 backdrop-blur-[1px]' : 'bg-slate-800'}`}></div>

                <div className="relative flex flex-col items-center justify-center h-full text-white p-6 md:p-12 pointer-events-auto overflow-y-auto no-scrollbar">
                  {page.rightContent && (
                    <div className="w-full max-w-xl animate-fade-in">
                      <h2 className={`text-2xl md:text-4xl font-bold uppercase mb-6 tracking-tight text-emerald-400 ${page.id === 'intro' ? 'text-center' : 'text-center md:text-left'}`}>
                        {page.rightContent.heading}
                      </h2>
                      <div className={`text-base md:text-lg font-light ${page.id === 'intro' ? 'text-center' : 'text-center md:text-left'}`}>
                        {page.rightContent.description}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
      
      {/* Global UI hints */}
      <div className="fixed bottom-8 right-8 z-40 hidden md:block">
        <div className="text-slate-500 text-xs flex flex-col items-center gap-1 opacity-50">
             <ChevronUp size={16} />
             <span>SCROLL</span>
             <ChevronDown size={16} />
        </div>
      </div>
    </div>
  );
}