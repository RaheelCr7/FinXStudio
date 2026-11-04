import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { setSandboxPolicy } from "@finx/mock-bank-api";
import { DEFAULT_STUDIO_URL } from "../studio-config";
import { hardeningFor, integrityVerdict, startBlock, type Integrity } from "./policy";
import { checkIntegrity, protectScreen } from "./native";

const policy = hardeningFor(process.env as Record<string, string | undefined>);
setSandboxPolicy({ allowed: policy.sandboxAllowed }); // before any bank is created

/** Wraps the whole app. In a demo build it renders the app at once and does nothing else. */
export function HardeningGate({ children }: { children: React.ReactNode }) {
  const [integrity, setIntegrity] = useState<Integrity | null>(policy.enabled ? null : "unknown");
  useEffect(() => {
    if (!policy.enabled) return;
    if (policy.blockCapture) void protectScreen();
    checkIntegrity().then(setIntegrity);
  }, []);

  if (!policy.enabled) return <>{children}</>;
  if (integrity === null) return <View style={{ flex: 1 }} />; // the check takes a moment; show nothing meanwhile
  const block = startBlock(policy, DEFAULT_STUDIO_URL, integrity);
  if (block) {
    return (
      <View accessibilityRole="alert" style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, backgroundColor: "#111" }}>
        <Text style={{ color: "#fff", fontSize: 18, fontWeight: "600", textAlign: "center", marginBottom: 12 }}>Cannot start</Text>
        <Text style={{ color: "#ddd", fontSize: 15, lineHeight: 22, textAlign: "center" }}>{block.message}</Text>
      </View>
    );
  }
  return (
    <>
      {integrityVerdict(policy, integrity) === "warn" ? (
        <View accessibilityRole="alert" style={{ backgroundColor: "#b45309", padding: 8 }}>
          <Text style={{ color: "#fff", fontSize: 13, textAlign: "center" }}>This device looks rooted or jailbroken. Your money may be at risk.</Text>
        </View>
      ) : null}
      {children}
    </>
  );
}
