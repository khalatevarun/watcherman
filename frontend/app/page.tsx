import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
            <h2>WatchMan - Focus on building great products and let us monitor the rest</h2>
        </div>
      </main>
    </div>
  );
}
