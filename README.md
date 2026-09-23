# Scene Cover Finder — Family Strokes

استخراج الغلاف الترويجي الرسمي من **Family Strokes / TeamSkeet**.

## التشغيل

```bash
npm install
npm run dev
```

افتح: http://localhost:3000

## أمثلة بحث

- `Family Vacation!!! Family Strokes`
- `Family Vacation`
- رابط مباشر: `https://www.familystrokes.com/movies/family-vacation`

## كيف يعمل

1. يكتشف الاستعلام (Family Strokes / TeamSkeet)
2. يفتح صفحة المشهد الرسمية على familystrokes.com
3. يستخرج `og:image` ثم يتحقق من CDN: `images.psmcdn.net/teamskeet/fs/.../shared/hi.jpg`
4. يرفض لقطات داخلية (stills / gallery)

ملاحظة: GitHub Pages لا يشغّل هذا السيرفر — شغّله محلياً أو على Vercel/Railway.
