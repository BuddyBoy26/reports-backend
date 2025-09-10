import { PdfReader } from 'pdfreader';

export class DocumentProcessor {
  async processPDF(buffer: Buffer): Promise<{ text: string; pages: number }> {
    try {
      console.log('[DocumentProcessor] Processing PDF, size:', buffer.length);
      
      return new Promise((resolve, reject) => {
        let fullText = '';
        let maxPage = 0;
        
        new PdfReader().parseBuffer(buffer, (err: any, item: any) => {
          if (err) {
            console.error('[DocumentProcessor] PdfReader error:', err);
            reject(new Error(`PDF parsing failed: ${err.message}`));
            return;
          }
          
          if (!item) {
            // End of file
            if (!fullText || fullText.trim().length === 0) {
              reject(new Error('No text found in PDF. This might be a scanned document.'));
              return;
            }
            
            console.log('[DocumentProcessor] Extracted text length:', fullText.length);
            console.log('[DocumentProcessor] Pages:', maxPage);
            
            resolve({
              text: fullText,
              pages: maxPage
            });
            return;
          }
          
          if (item.page) {
            maxPage = Math.max(maxPage, item.page);
          }
          
          if (item.text) {
            fullText += item.text + ' ';
          }
        });
      });
    } catch (error: any) {
      console.error('[DocumentProcessor] Error:', error);
      throw new Error(`PDF processing failed: ${error.message}`);
    }
  }
}