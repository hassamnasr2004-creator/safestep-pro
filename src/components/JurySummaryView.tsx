import React from 'react';
import {
  Building2,
  CheckCircle2,
  KeyRound,
  Lock,
  QrCode,
  Radar,
  ShieldCheck,
  Smile,
  Users,
  XCircle,
} from 'lucide-react';

export const JurySummaryView: React.FC = () => {
  const flowSteps = [
    {
      num: '01',
      title: 'الاستلام واختيار التصميم',
      desc: 'يتسلم الطفل سواراً سيليكونياً طبياً بتصميم محبب من البوث المركزي مع إغلاق القفل الذكي',
      icon: Lock,
    },
    {
      num: '02',
      title: 'الربط الفوري بكود QR',
      desc: 'يمسح ولي الأمر الكود بكاميرا هاتفه مباشرة دون تحميل تطبيق أو إنشاء حساب جديد',
      icon: QrCode,
    },
    {
      num: '03',
      title: 'المراقبة والإنذار الذكي',
      desc: 'تتبع دقيق للنطاق الآمن وبوابات الخروج مع إيقاف تلقائي للإنذار فور عودة الطفل للأمان',
      icon: Radar,
    },
    {
      num: '04',
      title: 'التسليم الآمن بالرمز',
      desc: 'يُفك السوار وتُغلق الجلسة عند المغادرة فقط بعد مطابقة رمز التسليم الخاص بولي الأمر',
      icon: KeyRound,
    },
  ];

  const problems = [
    'فقدان الأطفال داخل المولات المزدحمة خلال لحظات من الانشغال',
    'اعتماد الأنظمة التقليدية على النداء الصوتي المتأخر بعد حدوث الضياع',
    'رفض الأطفال ارتداء أجهزة التتبع الثقيلة أو سهلة الخلع',
    'ضعف إشارة GPS التقليدية داخل المباني المغلقة والمراكز التجارية',
  ];

  const solutions = [
    'إنذار استباقي فوري عند تجاوز نطاق الأمان أو الاقتراب من بوابات الخروج',
    'خريطة داخلية ذكية تحدد القطاع الفعلي ومسار خطوات الطفل بدقة لحظية',
    'سوار سيليكوني خفيف بتصميمات محببة ومزوّد بقفل أمان يمنع الفك العشوائي',
    'تجربة فورية عبر مسح QR في أقل من 15 ثانية دون تثبيت أي تطبيقات',
  ];

  const stakeholders = [
    {
      title: 'القيمة لأولياء الأمور',
      icon: Users,
      tint: 'bg-teal-50 text-teal-800',
      points: [
        'راحة بال كاملة أثناء التسوق مع رؤية المسافة والقطاع لحظياً',
        'تنبيه صوتي واهتزاز فوري عند أي ابتعاد أو اقتراب من البوابات',
        'خصوصية تامة عبر رابط معزول ينتهي تلقائياً فور تسليم السوار',
      ],
    },
    {
      title: 'القيمة للطفل',
      icon: Smile,
      tint: 'bg-sky-50 text-sky-800',
      points: [
        'تصميمات محببة وخامة سيليكون طبية ناعمة ومريحة طوال الزيارة',
        'حرية اللعب والحركة الآمنة داخل مناطق الألعاب دون تقييد نفسي',
        'قفل ذكي يحمي السوار من السقوط أو الفك غير المقصود أثناء اللعب',
      ],
    },
    {
      title: 'القيمة لإدارة المول',
      icon: Building2,
      tint: 'bg-slate-900/8 text-slate-900',
      points: [
        'رفع معايير الأمان العائلي وزيادة مدة بقاء الأسر داخل المركز التجاري',
        'رصد استباقي للبوابات الأربعة وتقليل بلاغات فقدان الأطفال بشكل جذري',
        'تشغيل منظم عبر بوث مركزي وإصدار دفعات QR قابلة للتوسع بسهولة',
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Executive Project Overview Hero Card */}
      <section className="glass-surface rounded-2xl p-6 sm:p-8">
        <div className="max-w-3xl space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-teal-800">
            <ShieldCheck className="w-4 h-4" strokeWidth={1.9} />
            <span>ملخص العرض التنفيذي للجنة التحكيم</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-snug">
            منظومة SafeStep Booth لحماية الأطفال داخل المراكز التجارية
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            بوث ذكي يوفر أساور أمان قابلة لإعادة الاستخدام بتصميمات محببة للأطفال، ترتبط لحظياً بهاتف ولي الأمر عبر كود QR لتوفير حماية استباقية ضد الابتعاد، النسيان، محاولات فك السوار، أو الاقتراب من بوابات الخروج
          </p>
        </div>
      </section>

      {/* Problem vs Solution Architectural Comparison */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-surface rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
              <XCircle className="w-5 h-5" strokeWidth={1.85} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">التحدي الحالي في المولات</h2>
              <p className="text-xs text-slate-500">فجوة الأمان في الحلول التقليدية</p>
            </div>
          </div>

          <ul className="space-y-3 pt-1">
            {problems.map((item, idx) => (
              <li
                key={idx}
                className="flex items-start gap-3 text-xs sm:text-sm text-slate-700 leading-relaxed"
              >
                <span className="text-xs font-bold text-red-600 tabular-nums mt-0.5">
                  0{idx + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="glass-surface rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" strokeWidth={1.85} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">الحل الذكي عبر SafeStep Booth</h2>
              <p className="text-xs text-slate-500">حماية استباقية سلسة وموثوقة</p>
            </div>
          </div>

          <ul className="space-y-3 pt-1">
            {solutions.map((item, idx) => (
              <li
                key={idx}
                className="flex items-start gap-3 text-xs sm:text-sm text-slate-800 leading-relaxed"
              >
                <span className="text-xs font-bold text-teal-700 tabular-nums mt-0.5">
                  0{idx + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 4-Step Visitor Journey */}
      <section className="glass-surface rounded-2xl p-6 space-y-5">
        <div>
          <h2 className="text-base font-bold text-slate-900">رحلة الاستخدام في أربع خطوات</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            تصميم تشغيلي سريع يناسب كثافة الزوار في أوقات الذروة
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {flowSteps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.num}
                className="rounded-xl bg-white/80 border border-slate-200/80 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-slate-900/8 text-slate-900 flex items-center justify-center">
                    <Icon className="w-4 h-4" strokeWidth={1.85} />
                  </div>
                  <span className="text-xs font-bold text-slate-400 tabular-nums">{step.num}</span>
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900">{step.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Value Proposition Matrix (الأهل / الطفل / المول) */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {stakeholders.map((group) => {
          const Icon = group.icon;
          return (
            <div key={group.title} className="glass-surface rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${group.tint}`}
                >
                  <Icon className="w-5 h-5" strokeWidth={1.85} />
                </div>
                <h2 className="text-base font-bold text-slate-900">{group.title}</h2>
              </div>

              <ul className="space-y-2.5">
                {group.points.map((pt, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2.5 text-xs text-slate-600 leading-relaxed"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>
    </div>
  );
};
