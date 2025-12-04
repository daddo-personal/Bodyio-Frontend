import { useEffect, useState } from "react";
import Purchases from "react-native-purchases";

export default function useRevenueCat() {
  const [offerings, setOfferings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await Purchases.getOfferings();
        console.log("📦 RevenueCat offerings:", data);

        setOfferings(data.current);
      } catch (err) {
        console.log("❌ RevenueCat load error:", err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return { offerings, loading };
}
