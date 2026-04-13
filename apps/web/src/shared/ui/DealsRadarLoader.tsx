/**
 * DealsRadarLoader - Themed loading component for DealsScrapper
 *
 * Features a radar scanning animation that "hunts" for deals with animated
 * blips representing discovered deals. Perfect for page transitions and
 * data loading states in the DealsScrapper application.
 */
import React, { useState, useEffect } from 'react';
import * as styles from './DealsRadarLoader.css';

export interface DealsRadarLoaderProps {
  /** Loading message to display */
  message?: string;
  /** Subtext message */
  subtext?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Custom class name */
  className?: string;
}

const defaultMessages = [
  'Scanning for deals...',
  'Hunting discounts...',
  'Detecting bargains...',
  'Scraping offers...',
  'Finding savings...',
];

const defaultSubtexts = [
  'Please wait while we load your content',
  'Setting up your personalized experience',
  'Preparing your deal hunting dashboard',
  'Loading your saved preferences',
  'Getting everything ready for you',
];

export const DealsRadarLoader: React.FC<DealsRadarLoaderProps> = ({
  message,
  subtext,
  size = 'md',
  className = '',
}) => {
  const [currentMessage, setCurrentMessage] = useState(
    message || defaultMessages[0]
  );
  const [currentSubtext, setCurrentSubtext] = useState(
    subtext || defaultSubtexts[0]
  );

  // Rotate through different messages if no custom message provided
  useEffect(() => {
    if (!message || !subtext) {
      const interval = setInterval(() => {
        const randomMessage =
          defaultMessages[Math.floor(Math.random() * defaultMessages.length)];
        const randomSubtext =
          defaultSubtexts[Math.floor(Math.random() * defaultSubtexts.length)];

        if (!message) setCurrentMessage(randomMessage);
        if (!subtext) setCurrentSubtext(randomSubtext);
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [message, subtext]);

  const containerClasses =
    `${styles.container} ${styles.sizes[size]} ${className}`.trim();

  return (
    <div className={containerClasses}>
      {/* Radar Animation */}
      <div className={styles.radarContainer}>
        {/* Background radar circles */}
        <div className={styles.radarCircle1} />
        <div className={styles.radarCircle2} />
        <div className={styles.radarCircle3} />

        {/* Radar sweep line */}
        <div className={styles.radarSweepLine} />

        {/* Deal blips */}
        <div className={styles.dealBlip1} />
        <div className={styles.dealBlip2} />
        <div className={styles.dealBlip3} />
        <div className={styles.dealBlip4} />

        {/* Center radar hub */}
        <div className={styles.radarHub} />
      </div>

      {/* Loading text */}
      <div className={styles.loadingText}>{currentMessage}</div>

      <div className={styles.loadingSubtext}>{currentSubtext}</div>
    </div>
  );
};

export default DealsRadarLoader;
