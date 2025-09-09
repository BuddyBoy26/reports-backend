export interface ExtractedBillData {
  consignee_name?: string | null;
  consignee_importer?: string | null;
  applicant_survey?: string | null;
  underwriter_name?: string | null;
  cha_name?: string | null;
  certificate_no?: string | null;
  endorsement_no?: string | null;
  invoice_no?: string | null;
  invoice_date?: string | null;
  invoice_value?: string | null;
  invoice_pcs?: string | null;
  invoice_gross_wt?: string | null;
  invoice_net_wt?: string | null;
}

export interface ExtractionResponse {
  success: boolean;
  extractedData?: ExtractedBillData;
  message?: string;
}