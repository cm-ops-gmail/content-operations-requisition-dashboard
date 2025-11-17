import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-background border-t">
      <div className="container mx-auto py-8 px-4 md:px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">&copy; 2025 10 MS Content Operations. All rights reserved.</span>
          </div>
          <nav className="flex items-center gap-4 md:gap-6">
            <Link href="https://docs.google.com/spreadsheets/d/1DqhomjY3uoNZkfOyRWo4kZY7JOQB6WTOoBOYNLR4WH0/edit?gid=467319743#gid=467319743" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Policy Book
            </Link>
            <Link href="https://10ms-content-operations-projects-teal.vercel.app/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Automation Projects
            </Link>
            <Link href="https://chatgpt.com/g/g-68646554a7508191b6cdf0333bbb3d11-content-ops-assistant" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Automation Documentation
            </Link>
          
          </nav>
        </div>
      </div>
    </footer>
  );
}
