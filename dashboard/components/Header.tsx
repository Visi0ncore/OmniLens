import Link from 'next/link';
import Image from 'next/image';
import { Github } from 'lucide-react';

export default function Header() {
  return (
    <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left side - App icon and name */}
          <div className="flex items-center gap-4">
            {/* App icon */}
            {/* <div className="h-8 w-8 flex-shrink-0"> */}
            {/* <div className="h-12 w-12 -mt-2 -mb-2">
              <Image
                src="/logo.jpeg"
                alt="OmniLens"
                width={64}
                height={64}
                className="w-full h-full object-contain"
                priority
              />
            </div> */}
            
            {/* App name */}
            <h1 className="text-3xl font-bold tracking-tight">OmniLens</h1>
          </div>

          {/* Right side - Social links */}
          <div className="flex items-center gap-4">
            <Link 
              href="https://github.com/Visi0ncore/OmniLens" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="GitHub"
            >
              <Github className="h-6 w-6" />
            </Link>
            <Link 
              href="https://omnilens.mintlify.app/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Documentation"
            >
              <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 1000 1000" aria-hidden="true">
                <path d="M357.333 418.638C357.755 361.053 380.592 305.898 420.999 264.869H420.925L264.923 420.872H264.997C264.416 421.328 263.869 421.826 263.359 422.361C225.419 460.251 202.417 510.552 198.573 564.034C194.73 617.516 210.303 670.59 242.434 713.516L400.001 555.949L401.639 554.386C372.271 515.277 356.691 467.54 357.333 418.638V418.638Z" fill="currentColor"/>
                <path d="M736.133 580.076C706.275 609.337 668.795 629.62 627.968 638.612C587.141 647.605 544.608 644.944 505.219 630.935C484.219 623.48 464.481 612.857 446.691 599.436L445.052 601.075L287.486 758.566C330.43 790.618 383.475 806.141 436.922 802.299C490.37 798.457 540.649 775.506 578.567 737.642L580.13 736.078L736.133 580.076Z" fill="currentColor"/>
                <path d="M802.999 420.871V206C802.999 201.582 799.417 198 794.999 198H580.128C550.857 197.971 521.869 203.725 494.829 214.932C467.789 226.139 443.229 242.578 422.562 263.305L420.998 264.869C393.755 292.526 374.264 326.86 364.479 364.427C382.192 359.841 400.394 357.415 418.689 357.204C467.594 356.629 515.318 372.231 554.438 401.585C589.596 427.805 616.205 463.845 630.912 505.165C645.9 547.397 647.872 593.155 636.572 636.519C674.146 626.751 708.484 607.258 736.13 580.001L737.694 578.512C758.43 557.835 774.874 533.264 786.081 506.21C797.289 479.156 803.038 450.154 802.999 420.871Z" fill="currentColor"/>
              </svg>
            </Link>
            <Link 
              href="https://x.com/OmniLensApp" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="X (formerly Twitter)"
            >
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
