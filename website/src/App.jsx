import { MotionConfig } from 'motion/react'
import { Header } from './components/Header'
import { Hero } from './components/Hero'
import { FieldPhoto } from './components/FieldPhoto'
import { TestBoard } from './components/TestBoard'
import { ToolSwitches } from './components/ToolSwitches'
import { DriversFlow } from './components/DriversFlow'
import { Brands } from './components/Brands'
import { Faq } from './components/Faq'
import { Cta, Footer } from './components/Closing'

export default function App() {
  return (
    // Visitors who ask for reduced motion keep every fade but lose the travel
    <MotionConfig reducedMotion="user">
      <Header />
      <main id="main">
        <Hero />
        <FieldPhoto />
        <TestBoard />
        <ToolSwitches />
        <DriversFlow />
        <Brands />
        <Faq />
        <Cta />
      </main>
      <Footer />
    </MotionConfig>
  )
}
