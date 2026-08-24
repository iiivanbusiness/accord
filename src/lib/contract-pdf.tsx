import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import type { Clause } from "./contract";

const styles = StyleSheet.create({
  page: { padding: 56, fontSize: 11, fontFamily: "Helvetica", color: "#14181A" },
  logo: { height: 28, marginBottom: 18, objectFit: "contain" },
  title: { fontSize: 20, marginBottom: 6, fontFamily: "Helvetica-Bold" },
  parties: { fontSize: 11, color: "#5B6461", marginBottom: 26 },
  clause: { marginBottom: 16 },
  clauseTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  clauseBody: { fontSize: 11, lineHeight: 1.5, color: "#3A403D" },
  signatureImage: { width: 160, height: 50, marginTop: 6, marginBottom: 4 },
  footer: { position: "absolute", bottom: 40, left: 56, right: 56, fontSize: 9, color: "#9AA19C", textAlign: "center" },
});

export function ContractPdfDocument({
  templateName,
  agencyName,
  agencyLogo,
  clientName,
  clauses,
  signedBy,
  signedAt,
  signatureImage,
}: {
  templateName: string;
  agencyName: string;
  agencyLogo?: string | null;
  clientName: string;
  clauses: Clause[];
  signedBy?: string | null;
  signedAt?: Date | null;
  signatureImage?: string | null;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {agencyLogo && <Image style={styles.logo} src={agencyLogo} />}
        <Text style={styles.title}>{templateName}</Text>
        <Text style={styles.parties}>Between {agencyName} and {clientName}</Text>
        {clauses.map((clause, i) => (
          <View key={clause.title} style={styles.clause}>
            <Text style={styles.clauseTitle}>{i + 1}. {clause.title}</Text>
            <Text style={styles.clauseBody}>{clause.body}</Text>
          </View>
        ))}
        {signedBy && signedAt && (
          <View style={styles.clause}>
            <Text style={styles.clauseTitle}>Signature</Text>
            {signatureImage && <Image style={styles.signatureImage} src={signatureImage} />}
            <Text style={styles.clauseBody}>Signed electronically by {signedBy} on {signedAt.toLocaleDateString()}.</Text>
          </View>
        )}
        <Text style={styles.footer} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  );
}
