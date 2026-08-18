import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { Clause } from "./contract";

const styles = StyleSheet.create({
  page: { padding: 56, fontSize: 11, fontFamily: "Helvetica", color: "#14181A" },
  title: { fontSize: 20, marginBottom: 6, fontFamily: "Helvetica-Bold" },
  parties: { fontSize: 11, color: "#5B6461", marginBottom: 26 },
  clause: { marginBottom: 16 },
  clauseTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  clauseBody: { fontSize: 11, lineHeight: 1.5, color: "#3A403D" },
  footer: { position: "absolute", bottom: 40, left: 56, right: 56, fontSize: 9, color: "#9AA19C", textAlign: "center" },
});

export function ContractPdfDocument({
  templateName,
  clientName,
  clauses,
  signedBy,
  signedAt,
}: {
  templateName: string;
  clientName: string;
  clauses: Clause[];
  signedBy?: string | null;
  signedAt?: Date | null;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{templateName}</Text>
        <Text style={styles.parties}>Between Horizon Media and {clientName}</Text>
        {clauses.map((clause, i) => (
          <View key={clause.title} style={styles.clause}>
            <Text style={styles.clauseTitle}>{i + 1}. {clause.title}</Text>
            <Text style={styles.clauseBody}>{clause.body}</Text>
          </View>
        ))}
        {signedBy && signedAt && (
          <View style={styles.clause}>
            <Text style={styles.clauseTitle}>Signature</Text>
            <Text style={styles.clauseBody}>Signed electronically by {signedBy} on {signedAt.toLocaleDateString()}.</Text>
          </View>
        )}
        <Text style={styles.footer} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  );
}
