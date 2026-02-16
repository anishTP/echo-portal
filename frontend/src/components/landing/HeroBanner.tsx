import styles from './HeroBanner.module.css';

export function HeroBanner() {
  return (
    <div className={styles.hero}>
      <img
        src="/hero-banner.png"
        alt="ECHO — Fibonacci numbers over Africa map"
        className={styles.heroImage}
      />
    </div>
  );
}
