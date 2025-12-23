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
      model: "gemini-2.5-flash-exp",
      generationConfig: {
        temperature: 0.1,
        topP: 0.8,
        maxOutputTokens: 4096,
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
      
      return this.parseExtractionResult(text) as ExtractedBillData;
    } catch (error: any) {
      console.error('[GeminiExtractor] Error:', error);
      throw new Error(`AI extraction failed: ${error.message}`);
    }
  }

  async extractSelectiveFields(
    pdfText: string, 
    fieldsToExtract: string[],
    documentType?: string
  ): Promise<Record<string, any>> {
    const prompt = this.createSelectiveExtractionPrompt(fieldsToExtract, documentType);
    
    try {
      console.log('[GeminiExtractor] Starting selective extraction...');
      console.log('[GeminiExtractor] Fields requested:', fieldsToExtract.length);
      console.log('[GeminiExtractor] Document type:', documentType || 'Generic');
      
      const result = await this.model.generateContent([
        prompt,
        `\n\nDocument Content:\n${pdfText}`
      ]);

      const response = await result.response;
      const text = response.text();
      
      console.log('[GeminiExtractor] Raw response length:', text.length);
      
      const extractedData = this.parseExtractionResult(text);
      
      // Filter to only return requested fields (in case Gemini returns extra)
      const filteredData: Record<string, any> = {};
      fieldsToExtract.forEach(field => {
        if (extractedData[field] !== undefined && extractedData[field] !== null) {
          filteredData[field] = extractedData[field];
        }
      });
      
      console.log('[GeminiExtractor] Filtered to requested fields:', Object.keys(filteredData).length);
      
      return filteredData;
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

    private parseExtractionResult(text: string): Record<string, any> {
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


  private createSelectiveExtractionPrompt(
      fieldsToExtract: string[],
      documentType?: string
    ): string {
      // Convert field names to readable labels
      // e.g., 'policy_number' -> 'Policy Number'
      const fieldDescriptions = fieldsToExtract.map(field => {
        const readableLabel = field
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        
        return `  "${field}": "Extract the value for '${readableLabel}'"`;
      }).join(',\n');

      const docTypeContext = documentType 
        ? `This is a ${documentType}.` 
        : 'This is a business document.';

      return `You are a specialized document extraction AI for ${documentType || 'business documents'}.

    ${docTypeContext}

    Extract ONLY the following specific fields and return a valid JSON object:

    {
    ${fieldDescriptions}
    }

    CRITICAL INSTRUCTIONS:
    1. Return ONLY a valid JSON object, no explanations or markdown
    2. Extract ONLY the fields listed above - do not add any other fields
    3. If a field is not found in the document, use null as the value
    4. For numeric values, extract only numbers (remove currency symbols like Rs, $, etc.)
    5. For dates, preserve the format found in the document
    6. Look for the field labels case-insensitively and with flexible matching
    7. Search for variations, abbreviations, and common alternative names
    8. For amounts/values, include only the number (e.g., "50000" not "Rs. 50,000")
    9. For names, include the full name as it appears
    10. For numbers like policy numbers or certificate numbers, preserve the exact format
    11. Search thoroughly through the ENTIRE document for each field
    12. Look in tables, forms, headers, and text sections
    13. If you find multiple instances of a field, use the most prominent or first occurrence

    IMPORTANT: Be aggressive in your search. Look for:
    - Exact field name matches
    - Partial matches (e.g., "Policy No" matches "policy_number")
    - Common abbreviations (e.g., "Amt" for "Amount", "No" for "Number")
    - Field names in different formats (with/without colons, different spacing)
    - Values that appear near the field labels

    Return format example:
    {
      "field_name": "extracted value",
      "another_field": "another value",
      "not_found_field": null
    }`;
    }
}
