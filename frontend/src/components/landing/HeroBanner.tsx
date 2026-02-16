import heroBanner from '../../assets/hero-banner.png';
import styles from './HeroBanner.module.css';

export function HeroBanner() {
  return (
    <div className={styles.hero}>
      <img
        src={heroBanner}
        alt="ECHO — Fibonacci numbers over Africa map"
        className={styles.heroImage}
      />
    </div>
  );
}
