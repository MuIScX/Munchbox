"use client";
import PredictNotification from "./PredictNotification";

export default function ClientProviders({ children }) {
  return (
    <>
      {children}
      <PredictNotification />
    </>
  );
}
