import { MobileNavbar } from './MobileNavbar'

export function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 font-gujarati">
      {/* Mobile Navbar */}
      <MobileNavbar />

      {/* Main Content */}
      <main className="w-full max-w-[414px] mx-auto overflow-y-auto pt-16 pb-16 min-h-screen">
        {children}
      </main>
    </div>
  )
}
