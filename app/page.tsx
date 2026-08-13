import { HeroSection } from "@/components/sections/hero"
import { VisionSection } from "@/components/sections/vision"
import { PhilosophySection } from "@/components/sections/philosophy"
import { ExperienceSection } from "@/components/sections/experience"
import { SpacesSection } from "@/components/sections/spaces"
import { DishesSection } from "@/components/sections/dishes"
import { ContactSection } from "@/components/sections/contact"

export default function Home() {
  return (
    <main id="contenido" className="min-h-screen bg-background">
      <HeroSection />
      <VisionSection />
      <PhilosophySection />
      <ExperienceSection />
      <SpacesSection />
      <DishesSection />
      <ContactSection />
    </main>
  )
}
