import './globals.css';
export const metadata={title:'貳恭 ER GONG｜濕式牛肉乾',description:'咬得到肉的濕式牛肉乾。探索貳恭的經典口味與分享組合。',icons:{icon:'/assets/ergong-icon.svg',apple:'/assets/ergong-touch-icon.png'},openGraph:{title:'貳恭 ER GONG｜濕式牛肉乾',description:'濕潤肉感、濃郁醬香。7-11 冷凍取貨、貨到付款。'}};
export const viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#F26A21'};
export default function RootLayout({children}){return <html lang="zh-Hant"><head><link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/><link href="https://fonts.googleapis.com/css2?family=Anton&family=Noto+Sans+TC:wght@400;500;700;900&display=swap" rel="stylesheet"/></head><body>{children}</body></html>}
