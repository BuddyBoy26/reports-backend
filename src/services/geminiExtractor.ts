import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ExtractedBillData {
  consignee_name?: string;
  consignee_importer?: string;
  applicant_survey?: string;
  underwriter_name?: string;
  cha_name?: string;
  certificate_no?: string;
  endorsement_no?: string;
  invoice_no?: string;
  invoice_date?: string;
  invoice_value?: string;
  invoice_pcs?: string;
  invoice_gross_wt?: string;
  invoice_net_wt?: string;
}

export class GeminiExtractor {
  private model: any;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    
    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash-lite",
      generationConfig: {
        temperature: 0.1,
        topP: 0.8,
        maxOutputTokens: 2048,
      }
    });
  }

  async extractBillOfEntryData(pdfText: string, customLabels: Record<string, string> = {}): Promise<ExtractedBillData> {
    const prompt = this.createDynamicExtractionPrompt(customLabels);
    
    try {
      console.log('[GeminiExtractor] Starting extraction with custom labels...');
      console.log('[GeminiExtractor] Custom labels count:', Object.keys(customLabels).length);
      
      const result = await this.model.generateContent([
        prompt,
        `\n\nDocument Content:\n${pdfText}`
      ]);

      const response = await result.response;
      const text = response.text();
      
      console.log('[GeminiExtractor] Raw response length:', text.length);
      
      return this.parseExtractionResult(text);
    } catch (error: any) {
      console.error('[GeminiExtractor] Error:', error);
      throw new Error(`AI extraction failed: ${error.message}`);
    }
  }

  private createDynamicExtractionPrompt(customLabels: Record<string, string>): string {
    // Default field mappings
    const defaultFields: Record<string, string> = {
      'consignee_name': 'Name of Consigner of Goods (Exporter)',
      'consignee_importer': 'Name of Consignee of Goods (Importer)',
      'applicant_survey': 'Applicant of Survey',
      'underwriter_name': 'Name of Underwriter / Insurer',
      'cha_name': 'Name of CHA / Clearing Agent / Forwarder',
      'certificate_no': 'Certificate No (if Applicable)',
      'endorsement_no': 'Endorsement No (if Any)',
      'invoice_no': 'Invoice Details Invoice No',
      'invoice_date': 'Invoice Details Invoice Date',
      'invoice_value': 'Invoice Details Invoice Value',
      'invoice_pcs': 'Invoice Details No of PKG',
      'invoice_gross_wt': 'Invoice Details Gross WT',
      'invoice_net_wt': 'Invoice Details Net WT'
    };

    // Merge with user's custom labels
    const finalFields = { ...defaultFields };
    Object.entries(customLabels).forEach(([key, label]) => {
      if (finalFields[key] && label.trim()) {
        finalFields[key] = label;
        console.log(`[GeminiExtractor] Using custom label for ${key}: "${label}"`);
      }
    });

    // Create dynamic JSON structure for prompt
    const fieldDescriptions = Object.entries(finalFields)
      .map(([key, label]) => `  "${key}": "Extract value for '${label}'"`)
      .join(',\n');

    return `You are a specialized document extraction AI for Bill of Entry documents.

Extract the following information and return ONLY a valid JSON object:

{
${fieldDescriptions}
}

CRITICAL INSTRUCTIONS:
1. Return ONLY the JSON object, no explanations
2. If a field is not found, use null
3. For numeric values, extract only numbers (remove currency symbols)
4. For dates, use DD-MM-YYYY format
5. Look for the EXACT field labels provided above in the document
6. Match field labels case-insensitively and with partial matching
7. The user has customized these field labels, so search for the exact text provided
8. Look for variations and common abbreviations of the field names
9. For company names, include the full legal entity name
10. For invoice details, look in tables, forms, or structured sections

Search thoroughly through the entire document for each field.`;
  }

  private parseExtractionResult(text: string): ExtractedBillData {
    try {
      let cleanedText = text.trim();
      
      // Remove markdown code blocks
      cleanedText = cleanedText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      
      // Extract JSON object
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        console.error('[GeminiExtractor] No JSON found in response:', text);
        throw new Error('No valid JSON found in AI response');
      }

      const extractedData = JSON.parse(jsonMatch[0]);
      console.log('[GeminiExtractor] Successfully extracted fields:', Object.keys(extractedData).length);
      
      return extractedData;
    } catch (error: any) {
      console.error('[GeminiExtractor] Parse error:', error);
      throw new Error(`Invalid response format: ${error.message}`);
    }
  }
}
