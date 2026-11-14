import { GoogleGenAI, Type } from '@google/genai';
import type { CustomsItem, CustomsItemInput } from '../src/types.js';

function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('مفتاح GEMINI_API_KEY غير مهيأ على الخادم.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export async function parseCustomsDocumentWithGemini(
  base64Data: string,
  mimeType: string
): Promise<CustomsItemInput[]> {
  const ai = getAiClient();

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType,
            data: base64Data,
          },
        },
        {
          text: `استخرج جميع أصناف القيمة الجمركية من هذا المستند بدقة تامة وحوّلها إلى مصفوفة JSON.
كل صنف يجب أن يحتوي على الحقول الـ 13 التالية بالضبط:
1. productName: اسم المنتج
2. category: الصنف أو الفئة
3. brand: الماركة أو العلامة التجارية
4. originCountry: بلد المنشأ
5. sizeOrMeasure: الحجم أو القياس أو الوزن
6. barcode: الباركود (إن وجد وإلا نص فارغ)
7. hsCode: البند التعريفي الجمركي (HS Code)
8. price: السعر كرقم (number)
9. currency: رمز العملة مثل USD أو SAR أو EUR أو AED
10. packageType: نوع العبوة أو التغليف
11. declarationNumber: رقم البيان الجمركي
12. declarationDate: تاريخ مرجع البيان (يفضل بصيغة YYYY-MM-DD)
13. notes: ملاحظات إضافية

إذا كان أي حقل نصي غير مذكور في المستند، اتركه نصاً فارغاً "" وإذا كان السعر غير واضح ضعه 0.`,
        },
      ],
    },
    config: {
      systemInstruction:
        'أنت خبير جمركي متخصص في استخراج جداول الفواتير والبيانات الجمركية العربية والإنجليزية بدقة عالية وتنسيقها في الحقول الـ 13 المحددة.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            productName: { type: Type.STRING, description: 'العمود 1: اسم المنتج' },
            category: { type: Type.STRING, description: 'العمود 2: الصنف' },
            brand: { type: Type.STRING, description: 'العمود 3: الماركة' },
            originCountry: { type: Type.STRING, description: 'العمود 4: بلد المنشأ' },
            sizeOrMeasure: { type: Type.STRING, description: 'العمود 5: الحجم أو القياس' },
            barcode: { type: Type.STRING, description: 'العمود 6: الباركود' },
            hsCode: { type: Type.STRING, description: 'العمود 7: البند التعريفي الجمركي' },
            price: { type: Type.NUMBER, description: 'العمود 8: السعر' },
            currency: { type: Type.STRING, description: 'العمود 9: رمز العملة' },
            packageType: { type: Type.STRING, description: 'العمود 10: نوع العبوة' },
            declarationNumber: { type: Type.STRING, description: 'العمود 11: رقم البيان' },
            declarationDate: { type: Type.STRING, description: 'العمود 12: تاريخ مرجع البيان' },
            notes: { type: Type.STRING, description: 'العمود 13: ملاحظات إضافية' },
          },
          required: ['productName', 'price', 'currency'],
        },
      },
    },
  });

  const rawText = (response.text ?? '[]').trim();
  const parsed = JSON.parse(rawText);
  if (!Array.isArray(parsed)) return [];
  return parsed.map((row) => ({
    productName: String(row.productName || ''),
    category: String(row.category || ''),
    brand: String(row.brand || ''),
    originCountry: String(row.originCountry || ''),
    sizeOrMeasure: String(row.sizeOrMeasure || ''),
    barcode: String(row.barcode || ''),
    hsCode: String(row.hsCode || ''),
    price: Number(row.price) || 0,
    currency: String(row.currency || 'USD').toUpperCase(),
    packageType: String(row.packageType || ''),
    declarationNumber: String(row.declarationNumber || ''),
    declarationDate: String(row.declarationDate || ''),
    notes: String(row.notes || ''),
  }));
}

export async function runCustomsAiAssistant(
  mode: 'analyze' | 'hs_lookup' | 'chat',
  query: string,
  items: CustomsItem[]
): Promise<string> {
  const ai = getAiClient();

  const compactItems = items.slice(0, 60).map((it) => ({
    productName: it.productName,
    category: it.category,
    brand: it.brand,
    originCountry: it.originCountry,
    sizeOrMeasure: it.sizeOrMeasure,
    hsCode: it.hsCode,
    price: it.price,
    currency: it.currency,
    declarationNumber: it.declarationNumber,
    declarationDate: it.declarationDate,
  }));

  let userPrompt = query;
  if (mode === 'analyze') {
    userPrompt = `حلل بيانات القيمة الجمركية التالية لنتائج البحث الحالية (${items.length} صنفاً، المعروض أدناه عينة من حتى 60 صنفاً).
قدم ملخصاً عملياً منظماً باللغة العربية يشمل:
- نطاق الأسعار والمتوسط لكل عملة موجودة
- توزيع بلدان المنشأ والماركات الرئيسية
- أي ملاحظات على تباين الأسعار أو البنود الجمركية (HS Codes)
- توصيات سريعة للتحقق الجمركي.

البيانات:
${JSON.stringify(compactItems)}`;
  } else if (mode === 'hs_lookup') {
    userPrompt = `اقترح البند التعريفي الجمركي (HS Code) المناسب بدقة للمنتج التالي: "${query}"
اذكر:
1. رمز البند المقترح (8 أرقام أو 6 أرقام دولية + التصنيف الفرعي)
2. الصنف الجمركي والفصل التابع له
3. المعايير التي قد تؤثر على التقييم الجمركي لهذا المنتج (المنشأ، الحجم، العبوة).`;
  } else {
    userPrompt = `سؤال المستخدم: ${query}

سياق نتائج البحث الحالية من قاعدة البيانات (${items.length} صنف):
${JSON.stringify(compactItems.slice(0, 30))}`;
  }

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: userPrompt,
    config: {
      systemInstruction:
        'أنت مستشار خبير في نظام القيمة الجمركية والبنود التعريفية (النظام المنسق HS) لمنصة "نظام القيمة الجمركية - وليد الراشد". أجب باللغة العربية بأسلوب مهني واضح ومباشر ومختصر.',
    },
  });

  return response.text ?? 'تعذر توليد استجابة في الوقت الحالي.';
}

export async function suggestItemFieldsWithGemini(productDescription: string): Promise<Partial<CustomsItemInput>> {
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `اقترح التصنيف الجمركي والبيانات القياسية للمنتج التالي: "${productDescription}"`,
    config: {
      systemInstruction: 'أعد كائن JSON يحتوي على اقتراحات عملية لحقول الصنف الجمركي.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING },
          hsCode: { type: Type.STRING },
          packageType: { type: Type.STRING },
          notes: { type: Type.STRING },
        },
      },
    },
  });
  try {
    return JSON.parse((response.text ?? '{}').trim());
  } catch {
    return {};
  }
}
