export type Role = "manager" | "surveyor" | "technician" | "client";

export type UnitStatus =
  | "pending"
  | "cs_scheduled"
  | "cs_completed"
  | "cw_scheduled"
  | "cw_in_progress"
  | "completed"
  | "opt_out"
  | "disabled";

export type GateType = "alum" | "mild_steel" | "wrought" | "ss";
export type DoorFrameCondition = "crack" | "chipped" | "scratch" | "warped" | "ok";
export type MainDoorType = "original" | "replaced" | "fire_rated";
export type ElectDBBoxLocation = "cornice" | "false_ceiling" | "cabinet" | "obstruction";
export type WallCondition = "uneven" | "plastered" | "rockstone" | "wallpaper";
export type CeilingCondition = "cornice" | "false_ceiling" | "rockstone" | "wallpaper";

export interface UnitActivityEntry {
  id: string;
  type:
    | "cs_scheduled"
    | "cs_cancelled"
    | "cs_completed"
    | "cw_scheduled"
    | "cw_cancelled"
    | "cw_completed"
    | "opt_out_requested"
    | "opt_out_approved"
    | "opt_out_reverted"
    | "cs_reminder_sent";
  appointmentDate?: string;
  appointmentTime?: string;
  assignee?: string;
  notes?: string;
  loggedAt: string;
}

export interface UnitData {
  unitNo: string;
  floor: number;
  lobby: string;
  exists: boolean;
  csStatus: "pending" | "scheduled" | "completed" | "opt_out";
  csDate?: string;
  csTime?: string;
  csAssignee?: string;
  csNotes?: string;
  csReminder1?: string;
  csReminder2?: string;
  csReminders?: string[];
  cwStatus: "pending" | "scheduled" | "in_progress" | "completed" | "opt_out";
  cwDate?: string;
  cwTime?: string;
  cwAssignee?: string;
  cwNotes?: string;
  flagged?: boolean;
  flagNote?: string;
  flagForAttention?: string;
  documents?: { name: string; url: string }[];
  resident?: { name: string; phone: string };
  survey?: {
    surveyDateTime?: string;
    existingLoadAmps: number;
    condition: "good" | "fair" | "poor";
    gateTypes?: GateType[];
    doorFrame?: DoorFrameCondition[];
    mainDoor?: MainDoorType[];
    electDBBox?: ElectDBBoxLocation[];
    wall?: WallCondition[];
    ceiling?: CeilingCondition[];
    notes: string;
    photos: string[];
    residentSignature?: string;
    signature?: string;
    ownerName?: string;
    ownerPhone?: string;
    scheduledCableWorkDate?: string;
    scheduledCableWorkTime?: string;
    custom?: Record<string, string | boolean | string[]>;
  };
  cableWork?: {
    scheduledDate?: string;
    scheduledTime?: string;
    technician: string;
    cableType?: string;
    photos?: string[];
    beforePhoto?: string;
    afterPhoto?: string;
    notes: string;
  };
  optOutRequest?: {
    reason: string;
    requestedDate: string;
    signature?: string;
    approved: boolean;
    hdbApprovedAt?: string;
    hdbSignoffUrl?: string;
  };
  activityLog?: UnitActivityEntry[];
  csDraft?: {
    ownerName?: string;
    ownerPhone?: string;
    surveyDateTime?: string;
    amps?: number;
    condition?: "good" | "fair" | "poor";
    notes?: string;
    photos?: string[];
    gateTypes?: string[];
    doorFrame?: string[];
    mainDoor?: string[];
    electDBBox?: string[];
    wall?: string[];
    ceiling?: string[];
    scheduledCableWorkDate?: string;
    scheduledCableWorkTime?: string;
    scheduledCableWorkTechnician?: string;
    customValues?: Record<string, string | boolean | string[]>;
  } | null;
}

export interface Block {
  id: string;
  name: string;
  precinct: string;
  /** Firestore document ID of the parent precinct — used to build write paths */
  precinctId: string;
  floors: number;
  /** Custom display label for each floor (key = floor number as string) */
  floorLabels?: Record<string, string>;
  lobbies: { name: string; stacks: string[] }[];
  units: Record<string, UnitData>;
}

export interface Appointment {
  id: string;
  blockId: string;
  unitKey: string;
  type: "CS" | "CW";
  date: string;
  time: string;
  assignee: string;
}

export interface Account {
  id: string;
  uid?: string;
  name: string;
  role: "manager" | "surveyor" | "technician" | "client";
  username: string;
  password: string;
}

export type DefaultSurveyGroup = "gate" | "doorFrame" | "mainDoor" | "electDBBox" | "wall" | "ceiling" | "scheduledCableWork";

export interface CustomSurveyField {
  id: string;
  label: string;
  type: "text" | "checkbox" | "checkbox_group";
  options?: string[];
}

export interface BlockedDate {
  id: string;
  date: string; // "DD/MM/YY"
  reason: string;
  type: "CS" | "CW" | "both";
}

// ---- Information Page ----
export type InfoLanguage = "en" | "zh" | "ms" | "ta";

export const INFO_LANGUAGES: { code: InfoLanguage; label: string; nativeLabel: string }[] = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "zh", label: "Chinese", nativeLabel: "中文" },
  { code: "ms", label: "Malay", nativeLabel: "Melayu" },
  { code: "ta", label: "Tamil", nativeLabel: "தமிழ்" },
];

export interface InfoParagraph {
  id: string;
  title: Record<InfoLanguage, string>;
  content: Record<InfoLanguage, string>;
}

export interface InfoDiagram {
  id: string;
  imageUrl: string;
  caption?: Record<InfoLanguage, string>;
}

export interface InfoFAQ {
  id: string;
  question: Record<InfoLanguage, string>;
  answer: Record<InfoLanguage, string>;
}

export interface InfoPageContent {
  paragraphs: InfoParagraph[];
  diagrams: InfoDiagram[];
  faqs: InfoFAQ[];
}

export const DEFAULT_INFO_PAGE: InfoPageContent = {
  paragraphs: [
    {
      id: "p1",
      title: {
        en: "About the Electrical Load Upgrading Programme (ELUP)",
        zh: "关于电力负荷升级计划（ELUP）",
        ms: "Mengenai Program Naik Taraf Beban Elektrik (ELUP)",
        ta: "மின் சுமை மேம்படுத்தல் திட்டத்தைப் பற்றி (ELUP)",
      },
      content: {
        en: "The Electrical Load Upgrading Programme (ELUP) is a government initiative to upgrade the electrical infrastructure in HDB residential blocks. The programme upgrades the main switch from 30 Amps to 40 Amps and replaces submain cables from 6mm² to 10mm², providing residents with greater electrical capacity for modern appliances and improving overall safety.",
        zh: "电力负荷升级计划（ELUP）是政府提升组屋住宅区电气基础设施的计划。该计划将主开关从30安培升级至40安培，并将副主电缆从6mm²更换为10mm²，为居民提供更大的用电容量，满足现代电器的需求，并提升整体安全性。",
        ms: "Program Naik Taraf Beban Elektrik (ELUP) adalah inisiatif kerajaan untuk menaik taraf infrastruktur elektrik di blok kediaman HDB. Program ini menaik taraf suis utama daripada 30 Ampere kepada 40 Ampere dan menggantikan kabel utama daripada 6mm² kepada 10mm², memberikan penduduk kapasiti elektrik yang lebih besar untuk peralatan moden dan meningkatkan keselamatan keseluruhan.",
        ta: "மின் சுமை மேம்படுத்தல் திட்டம் (ELUP) என்பது HDB குடியிருப்பு கட்டிடங்களில் மின் உள்கட்டமைப்பை மேம்படுத்துவதற்கான அரசாங்க முயற்சியாகும். இந்த திட்டம் முதன்மை சுவிட்சை 30 ஆம்பியரில் இருந்து 40 ஆம்பியராக மேம்படுத்துகிறது மற்றும் துணை முதன்மை கேபிளை 6mm² இலிருந்து 10mm² ஆக மாற்றுகிறது.",
      },
    },
    {
      id: "p2",
      title: {
        en: "What Happens During a Survey Visit",
        zh: "勘测到访期间会发生什么",
        ms: "Apa yang Berlaku Semasa Lawatan Tinjauan",
        ta: "ஆய்வு வருகையின் போது என்ன நடக்கும்",
      },
      content: {
        en: "A surveyor will visit your unit to assess the existing electrical infrastructure. The condition survey is non-intrusive and typically takes 15–30 minutes. The surveyor will check the electrical distribution box, cables, and other fittings to determine the scope of works required.",
        zh: "勘测员将到访您的单位，评估现有的电气基础设施。状态勘测不会造成干扰，通常需要15至30分钟。勘测员将检查电气配电箱、电线及其他配件，以确定所需的工程范围。",
        ms: "Juruukur akan melawat unit anda untuk menilai infrastruktur elektrik sedia ada. Tinjauan keadaan ini tidak mengganggu dan biasanya mengambil masa 15–30 minit. Juruukur akan memeriksa kotak agihan elektrik, kabel dan kelengkapan lain untuk menentukan skop kerja yang diperlukan.",
        ta: "தற்போதுள்ள மின் உள்கட்டமைப்பை மதிப்பிட ஒரு கணக்கெடுப்பாளர் உங்கள் அலகை பார்வையிடுவார். நிலை ஆய்வு தொந்தரவற்றது மற்றும் பொதுவாக 15–30 நிமிடங்கள் ஆகும். தேவையான பணிகளின் நோக்கத்தை தீர்மானிக்க கணக்கெடுப்பாளர் மின் விநியோக பெட்டி, கேபிள்கள் மற்றும் பிற பொருட்களை சரிபார்ப்பார்.",
      },
    },
  ],
  diagrams: [
    {
      id: "d1",
      imageUrl: "/elup-diagram-sample.jpg",
      caption: {
        en: "Illustration of ELUP Works in Residential Unit — Opt-In upgrades the main switch to 40A and cables to 10mm²; Opt-Out retains existing 30A switch and 6mm² cables.",
        zh: "住宅单位ELUP工程示意图 — 选择加入将主开关升级至40A，电缆升级至10mm²；选择退出则保留现有30A开关和6mm²电缆。",
        ms: "Ilustrasi Kerja ELUP di Unit Kediaman — Opt-In menaik taraf suis utama kepada 40A dan kabel kepada 10mm²; Opt-Out mengekalkan suis 30A dan kabel 6mm² sedia ada.",
        ta: "குடியிருப்பு அலகில் ELUP பணிகளின் விளக்கப்படம் — Opt-In முதன்மை சுவிட்சை 40A ஆகவும் கேபிளை 10mm² ஆகவும் மேம்படுத்துகிறது; Opt-Out தற்போதுள்ள 30A சுவிட்ச் மற்றும் 6mm² கேபிளை தக்க வைத்துக்கொள்கிறது.",
      },
    },
  ],
  faqs: [
    {
      id: "faq1",
      question: {
        en: "What is the Electrical Load Upgrading Programme (ELUP)?",
        zh: "什么是电力负荷升级计划（ELUP）？",
        ms: "Apakah Program Naik Taraf Beban Elektrik (ELUP)?",
        ta: "மின் சுமை மேம்படுத்தல் திட்டம் (ELUP) என்றால் என்ன?",
      },
      answer: {
        en: "ELUP is a national programme to upgrade electrical supply infrastructure in older HDB blocks. Works include upgrading the main switch from 30A to 40A and replacing submain cables from 6mm² to 10mm².",
        zh: "ELUP是一项针对旧组屋电力供应基础设施的全国性升级计划。工程包括将主开关从30A升级至40A，以及将副主电缆从6mm²更换为10mm²。",
        ms: "ELUP adalah program nasional untuk menaik taraf infrastruktur bekalan elektrik di blok HDB yang lebih lama. Kerja-kerja termasuk menaik taraf suis utama daripada 30A kepada 40A dan menggantikan kabel utama daripada 6mm² kepada 10mm².",
        ta: "ELUP என்பது பழைய HDB கட்டிடங்களில் மின் விநியோக உள்கட்டமைப்பை மேம்படுத்துவதற்கான தேசிய திட்டமாகும். 30A இலிருந்து 40A வரை முதன்மை சுவிட்சை மேம்படுத்துதல் மற்றும் 6mm² இலிருந்து 10mm² வரை கேபிளை மாற்றுதல் பணிகளில் அடங்கும்.",
      },
    },
    {
      id: "faq2",
      question: {
        en: "Will there be any disruption to my electricity supply?",
        zh: "我的电力供应是否会受到中断？",
        ms: "Adakah bekalan elektrik saya akan terganggu?",
        ta: "என் மின் விநியோகம் தடைப்படுமா?",
      },
      answer: {
        en: "There will be a temporary electrical shutdown of approximately 2–4 hours during the cable works at your unit. You will be notified in advance of the scheduled date and time.",
        zh: "在您单位进行电缆工程期间，将会有约2至4小时的临时断电。您将提前获知预定的日期和时间。",
        ms: "Akan ada penutupan elektrik sementara selama lebih kurang 2–4 jam semasa kerja kabel di unit anda. Anda akan diberitahu terlebih dahulu mengenai tarikh dan masa yang dijadualkan.",
        ta: "உங்கள் அலகில் கேபிள் பணிகளின் போது சுமார் 2–4 மணி நேரம் தற்காலிக மின் நிறுத்தம் இருக்கும். திட்டமிடப்பட்ட தேதி மற்றும் நேரம் பற்றி முன்கூட்டியே அறிவிக்கப்படுவீர்கள்.",
      },
    },
    {
      id: "faq3",
      question: {
        en: "Is there any cost to residents?",
        zh: "居民需要承担任何费用吗？",
        ms: "Adakah sebarang kos kepada penduduk?",
        ta: "குடியிருப்பாளர்களுக்கு ஏதாவது செலவு உண்டா?",
      },
      answer: {
        en: "The ELUP works are fully funded by the government. There is no cost to residents for the upgrading works.",
        zh: "ELUP工程由政府全额资助，居民无需承担任何升级工程费用。",
        ms: "Kerja-kerja ELUP dibiayai sepenuhnya oleh kerajaan. Tiada kos kepada penduduk untuk kerja-kerja naik taraf ini.",
        ta: "ELUP பணிகள் அரசாங்கத்தால் முழுமையாக நிதியளிக்கப்படுகின்றன. மேம்படுத்தல் பணிகளுக்கு குடியிருப்பாளர்களுக்கு எந்த செலவும் இல்லை.",
      },
    },
    {
      id: "faq4",
      question: {
        en: "What if I choose to opt out?",
        zh: "如果我选择退出会怎样？",
        ms: "Bagaimana jika saya memilih untuk tidak menyertai?",
        ta: "நான் வெளியேற தேர்வு செய்தால் என்ன ஆகும்?",
      },
      answer: {
        en: "If you opt out, there will be no change to your existing cables (6mm²) and your main switch will remain at 30 Amps. You will not benefit from the increased electrical capacity.",
        zh: "如果您选择退出，您现有的电线（6mm²）将保持不变，主开关也将维持在30安培。您将无法享受增加的用电容量。",
        ms: "Jika anda memilih untuk tidak menyertai, tiada perubahan akan dibuat pada kabel sedia ada anda (6mm²) dan suis utama anda akan kekal pada 30 Ampere. Anda tidak akan mendapat manfaat daripada kapasiti elektrik yang lebih tinggi.",
        ta: "நீங்கள் வெளியேற தேர்வு செய்தால், உங்கள் தற்போதுள்ள கேபிள்களில் (6mm²) எந்த மாற்றமும் இருக்காது மற்றும் உங்கள் முதன்மை சுவிட்ச் 30 ஆம்பியரிலேயே இருக்கும். அதிகரித்த மின் திறனால் நீங்கள் பயனடைய மாட்டீர்கள்.",
      },
    },
  ],
};
