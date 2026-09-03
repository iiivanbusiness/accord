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
  docusignBlock: { marginTop: 10, marginBottom: 8 },
  docusignLine: { fontSize: 10, color: "#5B6461", marginBottom: 14 },
  docusignAnchor: { fontSize: 6, color: "#F2F5F2" }, // near-invisible against a white page — DocuSign's anchor-string matching just needs the text to exist in the PDF's text layer, not to be legible
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
  docusignAnchors,
}: {
  templateName: string;
  agencyName: string;
  agencyLogo?: string | null;
  clientName: string;
  clauses: Clause[];
  signedBy?: string | null;
  signedAt?: Date | null;
  signatureImage?: string | null;
  // One entry per DocuSign recipient — each anchor string gets placed in
  // the PDF's text layer so DocuSign's anchor-tab matching can find it and
  // drop a signature field right there, without SealMe ever computing an
  // absolute x/y position on the page itself.
  docusignAnchors?: { label: string; anchor: string }[];
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
        {docusignAnchors && docusignAnchors.length > 0 && (
          <View style={styles.docusignBlock}>
            <Text style={styles.clauseTitle}>Signatures</Text>
            {docusignAnchors.map((a) => (
              <Text key={a.anchor} style={styles.docusignLine}>{a.label}: <Text style={styles.docusignAnchor}>{a.anchor}</Text></Text>
            ))}
          </View>
        )}
        <Text style={styles.footer} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  );
}
