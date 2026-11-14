"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Mark from "@/components/mark";
import Wordmark from "@/components/wordmark";
import CursorBackground from "@/components/cursor-background";
import OnboardingSteps from "@/components/onboarding-steps";
import { ONBOARDING_KEY } from "@/lib/onboarding";

export default function Welcome() {
  const router = useRouter();
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [introducing, setIntroducing] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(ONBOARDING_KEY)) router.replace("/");
    } catch {
      // Keep the welcome page available when browser storage is disabled.
    }
  }, [router]);

  const start = () => {
    setNavigationOpen(false);
    setIntroducing(true);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const finish = (answers: Record<string, string>) => {
    try {
      localStorage.setItem(ONBOARDING_KEY, JSON.stringify(answers));
      router.push("/");
    } catch {
      router.push("/?preview=1");
    }
  };

  if (introducing) return <div className="onboarding-entry"><OnboardingSteps onBack={() => setIntroducing(false)} onComplete={finish} /></div>;

  return (
    <main className="intro-page">
      <header className="intro-nav" onKeyDown={(event) => { if (event.key === "Escape") setNavigationOpen(false); }}>
        <div className="intro-brand"><Mark size={39} /><Wordmark className="text-3xl" /></div>
        <nav id="intro-navigation" aria-label="Main navigation" className={`intro-nav-links ${navigationOpen ? "is-open" : ""}`}>
          <a href="#how-it-works" onClick={() => setNavigationOpen(false)}>How it works</a>
          <a href="#our-mission" onClick={() => setNavigationOpen(false)}>Our mission</a>
          <a href="#whats-next" onClick={() => setNavigationOpen(false)}>What’s next</a>
        </nav>
        <div className="intro-nav-actions">
          <button className="intro-nav-start" onClick={start}>Start now <span aria-hidden="true">↗</span></button>
          <button className="intro-nav-toggle" type="button" aria-label={navigationOpen ? "Close navigation" : "Open navigation"} aria-controls="intro-navigation" aria-expanded={navigationOpen} onClick={() => setNavigationOpen(!navigationOpen)}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d={navigationOpen ? "M5 5l14 14M19 5L5 19" : "M4 7h16M4 12h16M4 17h16"} /></svg>
          </button>
        </div>
      </header>

      <section className="intro-hero">
        <CursorBackground />
        <div className="intro-hero-copy">
          <span className="intro-kicker"><span /> A little more clarity, a lot less paperwork</span>
          <h1>Claims are complicated.<br /><em>They don’t have to be.</em></h1>
          <p>Meet Fynish, a claim assistant designed to help you understand your policy, prepare documents, and find your next step.</p>
          <button onClick={start} className="intro-primary">Start now <span aria-hidden="true">↗</span></button>
          <span className="intro-preview-note">Explore the Fynish preview <span aria-hidden="true">✳</span></span>
        </div>

        <div className="journey-art" aria-hidden="true">
          <div className="journey-grid" />
          <div className="journey-orbit orbit-one" /><div className="journey-orbit orbit-two" />
          <div className="journey-spark spark-one">✳</div><div className="journey-spark spark-two">✦</div><div className="journey-spark spark-three">✳</div>
          <div className="journey-card journey-bill">
            <div className="journey-card-top"><span className="journey-icon bill-icon">✚</span><span className="journey-card-label">A hospital bill</span><span className="journey-dots">•••</span></div>
            <div className="bill-lines"><i /><i /><i /></div>
            <div className="bill-bottom"><span>One place to start</span><strong>₹</strong></div>
          </div>
          <div className="journey-card journey-policy">
            <span className="journey-icon policy-icon">▤</span>
            <div><small>Your policy</small><strong>Made clearer</strong></div>
            <span className="policy-check">✓</span>
          </div>
          <div className="journey-phone">
            <div className="phone-top"><span><Mark size={29} /> <b>Fynish</b></span><span className="phone-menu">•••</span></div>
            <div className="phone-date">A simpler way forward</div>
            <div className="phone-user">I have a hospital bill.<br />Where do I start?</div>
            <div className="phone-answer"><span className="phone-avatar"><Mark size={24} /></span><div>We’ll take it one step at a time.</div></div>
            <div className="phone-input">Ask about your claim <span>↑</span></div>
          </div>
          <div className="journey-tag"><span>✦</span> Less guesswork, more clarity</div>
        </div>
      </section>

      <section id="how-it-works" className="intro-story">
        <div className="story-heading"><span>Made for real life</span><h2>From “where do I start?”<br />to “I know what’s next.”</h2><p>Insurance can be hard to navigate. Fynish is designed to make the journey feel a little more human.</p></div>
        <div className="story-steps">
          <article><span className="story-icon">✚</span><span className="story-number">01</span><h3>Start with your bill</h3><p>Bring the moment that matters. A hospital bill is a place to begin.</p></article>
          <article><span className="story-icon">▤</span><span className="story-number">02</span><h3>Make sense of your cover</h3><p>Understand policy details and the documents a claim may need.</p></article>
          <article><span className="story-icon">✳</span><span className="story-number">03</span><h3>Know your next step</h3><p>Move through the process in plain language, one step at a time.</p></article>
        </div>
        <p className="story-disclaimer">This preview uses fictional insurer accounts and simulated claim submissions.</p>
      </section>
      <section id="our-mission" className="intro-mission">
        <div className="intro-section-inner mission-layout">
          <div><span className="section-label">Our mission</span><h2>Less uncertainty.<br />More confidence.</h2></div>
          <div className="mission-copy"><p>Getting care is hard enough. Understanding what comes next should be simpler.</p><p>We’re building Fynish to help people understand their cover, gather the right documents, and navigate claims in plain language.</p></div>
        </div>
      </section>
      <section id="whats-next" className="intro-roadmap">
        <div className="intro-section-inner">
          <span className="section-label">What’s next</span>
          <h2>What we’re working towards.</h2>
          <p className="roadmap-intro">We’re starting with health claims and building towards a more connected experience.</p>
          <div className="roadmap-list">
            <article><span>01</span><div><h3>Clearer claim checks</h3><p>Show missing documents and explain policy details before submission.</p></div></article>
            <article><span>02</span><div><h3>More ways to get help</h3><p>Explore support in more languages and channels.</p></div></article>
            <article><span>03</span><div><h3>A connected journey</h3><p>Explore consented payment signals that can help identify a possible claim.</p></div></article>
          </div>
          <p className="roadmap-note">These are planned capabilities. The current claim flow uses insurer simulations and sample claims.</p>
        </div>
      </section>
      <section className="intro-bottom"><div><span>A little help goes a long way</span><h2>Let’s find your next step.</h2></div><button onClick={start} className="intro-primary">Start now <span aria-hidden="true">↗</span></button></section>
      <footer className="intro-footer"><Wordmark className="text-2xl" /><span>For the moments that matter. Built at the Paytm AI Hackathon, Hyderabad.</span></footer>
    </main>
  );
}

