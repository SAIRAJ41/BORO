/**
 * Mock Data Engine for BORO
 *
 * Central data source during front-end mode (USE_MOCK=true).
 * All timestamps use the +05:30 Asia/Kolkata offset.
 * Dynamic dates are generated relative to the current local time so the app never shows stale data.
 */

const USE_MOCK = true;

// Helper: generate ISO string with Asia/Kolkata (+05:30) offset relative to now
function getRelativeDate(daysOffset = 0, hours = 0, mins = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  d.setHours(hours, mins, 0, 0);

  // Format to ISO with +05:30
  const tzOffset = 5.5 * 60; // in minutes
  const localTime = new Date(d.getTime() + (tzOffset * 60 * 1000));
  const iso = d.toISOString().replace('Z', '+05:30');
  return iso;
}

// Format relative date without time (YYYY-MM-DD)
function getRelativeDateString(daysOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const mockSettings = {
  max_active_bookings: 2,
  weekly_space_booking_limit_per_user: 3,
  score_start: 100,
  score_max: 120,
  score_min: 0,
  clean_return_bonus: 5,
  late_penalty: -10,
  noshow_penalty: -10,
  damage_penalty: -30,
  tier1_min: 80,
  tier2_min: 50,
  cancellation_warning_hours: 2,
  platform_fee_pct: 8,
  tiers: [
    {
      level: 1,
      name: "Normal Access",
      range: "80 – 120 pts",
      description: "Eligible for standard owner approval flow.",
      perks: ["Standard deposit rate", "Standard queue placement"]
    },
    {
      level: 2,
      name: "Owner Approval Required",
      range: "50 – 79 pts",
      description: "Requires explicit owner review of past history.",
      perks: ["Owner reviews past history", "Standard deposit rate"]
    },
    {
      level: 3,
      name: "Owner Review with Advisory Warning",
      range: "0 – 49 pts",
      description: "Owner decides with a prominent advisory warning banner.",
      perks: ["High caution advised", "Mandatory check-in walkthrough recommended"]
    }
  ],
  penalties: [
    { action: "Clean on-time return", points: 5, description: "Check-out on schedule, condition verified spotless" },
    { action: "Late return", points: -10, description: "Overstay past 15 min grace period without owner consent" },
    { action: "No-show reservation", points: -10, description: "Failure to check in without 2h advance cancellation" },
    { action: "Confirmed facility damage", points: -30, description: "Damage discovered during return inspection" }
  ]
};

const mockUsers = [
  {
    id: "USR-001",
    name: "Priya Mehta",
    email: "priya@demo.com",
    role: "user",
    score: 95, // 100 - 10 (late) + 5 (clean) = 95
    tier: 1,
    initials: "PM",
    status: "active",
    phone: "+91 98201 11223",
    active_bookings: 1, // BK-1001
    joined_at: "2025-01-15T00:00:00.000+05:30",
    verificationStatus: {
      is_verified: true,
      document_type: "Aadhaar Demo ID",
      verified_at: "2025-01-16T10:00:00.000+05:30"
    }
  },
  {
    id: "USR-002",
    name: "Aarav Sharma",
    email: "aarav@demo.com",
    role: "user",
    score: 75, // 100 - 30 (damage) + 5 (clean) = 75
    tier: 2,
    initials: "AS",
    status: "active",
    phone: "+91 98202 22334",
    active_bookings: 1, // BK-1002
    joined_at: "2025-02-10T00:00:00.000+05:30",
    verificationStatus: {
      is_verified: true,
      document_type: "Passport Demo ID",
      verified_at: "2025-02-12T14:30:00.000+05:30"
    }
  },
  {
    id: "USR-003",
    name: "Rajesh Kumar",
    email: "rajesh@demo.com",
    role: "owner",
    score: 100,
    tier: 1,
    initials: "RK",
    status: "active",
    phone: "+91 98203 33445",
    active_bookings: 0,
    joined_at: "2024-11-01T00:00:00.000+05:30",
    verificationStatus: {
      is_verified: true,
      document_type: "Property Deed & Aadhaar Demo",
      verified_at: "2024-11-05T11:00:00.000+05:30"
    },
    payoutMethod: {
      type: "bank_transfer",
      masked_details: "Demo Bank •••• 4092"
    }
  },
  {
    id: "USR-004",
    name: "Vikram Malhotra",
    email: "vikram@demo.com",
    role: "owner",
    score: 100,
    tier: 1,
    initials: "VM",
    status: "active",
    phone: "+91 98204 44556",
    active_bookings: 0,
    joined_at: "2024-12-05T00:00:00.000+05:30",
    verificationStatus: {
      is_verified: true,
      document_type: "Electricity Bill & PAN Demo",
      verified_at: "2024-12-08T16:00:00.000+05:30"
    },
    payoutMethod: {
      type: "upi",
      masked_details: "vikram@demo"
    }
  },
  {
    id: "USR-005",
    name: "Sunita Rao",
    email: "sunita@demo.com",
    role: "owner",
    score: 100,
    tier: 1,
    initials: "SR",
    status: "pending", // Pending owner verification
    phone: "+91 98205 55667",
    active_bookings: 0,
    joined_at: "2026-10-20T00:00:00.000+05:30",
    verificationStatus: {
      is_verified: false,
      document_type: "Aadhaar Demo ID & Property Tax Receipt",
      applied_at: "2026-10-20T16:00:00.000+05:30"
    }
  },
  {
    id: "USR-006",
    name: "Rohan Desai",
    email: "rohan@demo.com",
    role: "user",
    score: 45, // 100 - 30 (damage) - 15 (unreported late) - 10 (late) = 45
    tier: 3,
    initials: "RD",
    status: "active",
    phone: "+91 98206 66778",
    active_bookings: 1, // BK-1004
    joined_at: "2025-03-10T00:00:00.000+05:30",
    verificationStatus: {
      is_verified: true,
      document_type: "Voter Demo ID",
      verified_at: "2025-03-12T09:00:00.000+05:30"
    }
  },
  {
    id: "USR-007",
    name: "Ananya Iyer",
    email: "ananya@demo.com",
    role: "user",
    score: 105, // 100 + 5 (clean return) = 105
    tier: 1,
    initials: "AI",
    status: "active",
    phone: "+91 98207 77889",
    active_bookings: 1, // BK-1003
    joined_at: "2025-04-01T00:00:00.000+05:30",
    verificationStatus: {
      is_verified: true,
      document_type: "Aadhaar Demo ID",
      verified_at: "2025-04-03T11:00:00.000+05:30"
    }
  },
  {
    id: "USR-008",
    name: "Meera Nair",
    email: "meera@demo.com",
    role: "user",
    score: 100,
    tier: 1,
    initials: "MN",
    status: "active",
    phone: "+91 98208 88990",
    active_bookings: 1, // BK-1011
    joined_at: "2025-05-10T00:00:00.000+05:30",
    verificationStatus: {
      is_verified: true,
      document_type: "Passport Demo ID",
      verified_at: "2025-05-12T10:00:00.000+05:30"
    }
  },
  {
    id: "USR-099",
    name: "Amit Verma",
    email: "admin@demo.com",
    role: "admin",
    score: 100,
    tier: 1,
    initials: "AV",
    status: "active",
    phone: "+91 98200 00001",
    active_bookings: 0,
    joined_at: "2024-01-01T00:00:00.000+05:30"
  }
];

const mockSpaces = [
  {
    id: "SP-001",
    owner_id: "USR-003",
    name: "Shanti Niketan Community Ground",
    description: "Spacious outdoor sports ground suitable for football, cricket tournaments, yoga camps, and community assemblies.",
    address: "Plot 42, Sector 8, Vashi, Navi Mumbai",
    area: "Vashi, Navi Mumbai",
    space_type: "community_ground",
    indoor_outdoor: "outdoor",
    capacity: 200,
    price_per_hour: 500,
    deposit_amount: 2000,
    min_duration_hours: 2,
    facilities: ["parking", "floodlights", "water", "toilets", "boundary_wall"],
    allowed_purposes: ["sports", "event", "meeting"],
    rules: [
      { text: "No amplified speakers or loudspeakers after 9:00 PM" },
      { text: "Clear all event litter into designated municipal bins" },
      { text: "Ensure gates are locked when vacating the ground" }
    ],
    photos: [
      { url: "/images/spaces/community-ground-1.jpg", caption: "Main sports outfield and pitch" }
    ],
    verified: true,
    rating: 4.8,
    review_count: 42,
    hygiene_score: 9,
    slots: [
      { label: "Morning", start: "06:00", end: "10:00" },
      { label: "Evening", start: "16:00", end: "20:00" }
    ]
  },
  {
    id: "SP-002",
    owner_id: "USR-003",
    name: "Gulmohar Society Hall",
    description: "Centrally air-conditioned community hall equipped with audio system, modular seating, and pantry for cultural and civic events.",
    address: "Gulmohar Co-op Housing Society, Plot 14, Sector 19A, Nerul, Navi Mumbai",
    area: "Nerul, Navi Mumbai",
    space_type: "community_hall",
    indoor_outdoor: "indoor",
    capacity: 120,
    price_per_hour: 800,
    deposit_amount: 2500,
    min_duration_hours: 2,
    facilities: ["kitchen", "av_system", "parking", "wifi", "ramp", "ac"],
    allowed_purposes: ["meeting", "event", "study"],
    rules: [
      { text: "No open flames or indoor fireworks" },
      { text: "Noise curfew 10:00 PM (keep sound under 60dB)" },
      { text: "Sweep and clear trash prior to checkout" }
    ],
    photos: [
      { url: "/images/spaces/community-hall-1.jpg", caption: "Main assembly hall with acoustic panels" }
    ],
    verified: true,
    rating: 4.9,
    review_count: 84,
    hygiene_score: 10,
    slots: [
      { label: "Morning", start: "09:00", end: "13:00" },
      { label: "Afternoon", start: "14:00", end: "18:00" },
      { label: "Evening", start: "19:00", end: "23:00" }
    ]
  },
  {
    id: "SP-003",
    owner_id: "USR-003",
    name: "Vidya Mandir School Playground",
    description: "After-hours school playground with marked running track, basketball hoops, and floodlit court.",
    address: "Vidya Mandir Trust Campus, Sector 4, Kopar Khairane, Navi Mumbai",
    area: "Kopar Khairane, Navi Mumbai",
    space_type: "school_playground",
    indoor_outdoor: "outdoor",
    capacity: 150,
    price_per_hour: 400,
    deposit_amount: 1500,
    min_duration_hours: 2,
    facilities: ["parking", "toilets", "boundary_wall", "floodlights"],
    allowed_purposes: ["sports", "event"],
    rules: [
      { text: "Available only after school hours (after 5:00 PM weekdays and full days on weekends)" },
      { text: "No vehicles permitted inside track boundary" },
      { text: "Return school equipment to sports locker" }
    ],
    photos: [
      { url: "/images/spaces/school-playground-1.jpg", caption: "After-hours school playground court" }
    ],
    verified: true,
    rating: 4.7,
    review_count: 36,
    hygiene_score: 9,
    slots: [
      { label: "Evening", start: "17:00", end: "20:00" }
    ]
  },
  {
    id: "SP-004",
    owner_id: "USR-004",
    name: "Navprabhat Activity Room",
    description: "Compact, quiet multipurpose room ideal for tutoring, committee meetings, reading clubs, and art workshops.",
    address: "Navprabhat Community Center, 2nd Floor, Sector 15, Belapur, Navi Mumbai",
    area: "Belapur, Navi Mumbai",
    space_type: "small_room",
    indoor_outdoor: "indoor",
    capacity: 25,
    price_per_hour: 250,
    deposit_amount: 1000,
    min_duration_hours: 1,
    facilities: ["wifi", "ac", "whiteboard", "tables_chairs"],
    allowed_purposes: ["study", "meeting"],
    rules: [
      { text: "Turn off air conditioner and lights when leaving" },
      { text: "Wipe whiteboard clean after use" }
    ],
    photos: [
      { url: "/images/spaces/small-room-1.jpg", caption: "Study and activity room interior" }
    ],
    verified: true,
    rating: 4.8,
    review_count: 29,
    hygiene_score: 9,
    slots: [
      { label: "Morning", start: "09:00", end: "13:00" },
      { label: "Afternoon", start: "14:00", end: "18:00" }
    ]
  },
  {
    id: "SP-005",
    owner_id: "USR-004",
    name: "Pragati Community Storeroom B",
    description: "Secure, dry lockable storage unit with heavy-duty metal shelving for non-perishable community inventory and event goods.",
    address: "Basement Level 1, Pragati Commercial Complex, Sector 11, Belapur",
    area: "Belapur, Navi Mumbai",
    space_type: "storeroom",
    indoor_outdoor: "indoor",
    capacity: 10,
    price_per_hour: 150,
    deposit_amount: 1000,
    min_duration_hours: 4,
    facilities: ["cctv", "heavy_shelving", "lockable_door"],
    allowed_purposes: ["storage"],
    rules: [
      { text: "Strictly no hazardous or flammable materials" },
      { text: "Ensure padlock is firmly engaged upon departure" }
    ],
    photos: [
      { url: "/images/spaces/storeroom-1.jpg", caption: "Steel storage racking and security gate" }
    ],
    verified: true,
    rating: 4.6,
    review_count: 14,
    hygiene_score: 8,
    slots: [
      { label: "Daily Slot", start: "08:00", end: "20:00" }
    ]
  },
  {
    id: "SP-006",
    owner_id: "USR-004",
    name: "Sahyadri Sports Ground",
    description: "Large regional open field with full football boundary, cricket practice nets, and spectator seating.",
    address: "Opposite Sahyadri Gardens, Sector 21, Kharghar, Navi Mumbai",
    area: "Kharghar, Navi Mumbai",
    space_type: "community_ground",
    indoor_outdoor: "outdoor",
    capacity: 300,
    price_per_hour: 700,
    deposit_amount: 3000,
    min_duration_hours: 2,
    facilities: ["parking", "floodlights", "water", "toilets", "boundary_wall"],
    allowed_purposes: ["sports", "event"],
    rules: [
      { text: "Prior municipal clearance needed for sound equipment" },
      { text: "Clean dugout and sidelines after match" }
    ],
    photos: [
      { url: "/images/spaces/community-ground-1.jpg", caption: "Wide angle outfield and pavilions" }
    ],
    verified: true,
    rating: 4.9,
    review_count: 51,
    hygiene_score: 9,
    slots: [
      { label: "Morning", start: "06:00", end: "11:00" },
      { label: "Evening", start: "15:00", end: "19:00" }
    ]
  },
  {
    id: "SP-007",
    owner_id: "USR-003",
    name: "Kalyan Heritage Society Hall",
    description: "Grand community assembly space with heritage arches, stage lighting, and sound console for conferences and weddings.",
    address: "Kalyan Heritage Complex, Sector 12, Vashi, Navi Mumbai",
    area: "Vashi, Navi Mumbai",
    space_type: "community_hall",
    indoor_outdoor: "indoor",
    capacity: 180,
    price_per_hour: 1200,
    deposit_amount: 4000,
    min_duration_hours: 3,
    facilities: ["grand_stage", "kitchen", "av_system", "parking", "ac"],
    allowed_purposes: ["event", "meeting"],
    rules: [
      { text: "Stage lighting must be operated by certified technician" },
      { text: "Maintain cleanliness in green rooms" }
    ],
    photos: [
      { url: "/images/spaces/community-hall-1.jpg", caption: "Auditorium stage and seating" }
    ],
    verified: true,
    rating: 4.9,
    review_count: 98,
    hygiene_score: 10,
    slots: [
      { label: "Morning", start: "09:00", end: "13:00" },
      { label: "Evening", start: "17:00", end: "22:00" }
    ]
  },
  {
    id: "SP-008",
    owner_id: "USR-003",
    name: "Adarsh School Athletic Field",
    description: "Grass athletic pitch and 200m dirt track available for neighborhood sports leagues on weekends and holidays.",
    address: "Adarsh Vidyalaya Campus, Sector 7, Airoli, Navi Mumbai",
    area: "Airoli, Navi Mumbai",
    space_type: "school_playground",
    indoor_outdoor: "outdoor",
    capacity: 180,
    price_per_hour: 450,
    deposit_amount: 2000,
    min_duration_hours: 2,
    facilities: ["parking", "toilets", "boundary_wall"],
    allowed_purposes: ["sports"],
    rules: [
      { text: "No metal cleats allowed on running track" },
      { text: "Spectators must remain on bleachers" }
    ],
    photos: [
      { url: "/images/spaces/school-playground-1.jpg", caption: "Athletic oval and goalposts" }
    ],
    verified: true,
    rating: 4.6,
    review_count: 22,
    hygiene_score: 8,
    slots: [
      { label: "Morning", start: "07:00", end: "11:00" }
    ]
  },
  {
    id: "SP-009",
    owner_id: "USR-004",
    name: "Saraswati Study & Guild Room",
    description: "Cozy carpeted room with library shelves, round discussion tables, and high-speed Wi-Fi.",
    address: "Saraswati Mandir Library Annex, Sector 9, Vashi",
    area: "Vashi, Navi Mumbai",
    space_type: "small_room",
    indoor_outdoor: "indoor",
    capacity: 30,
    price_per_hour: 300,
    deposit_amount: 1000,
    min_duration_hours: 1,
    facilities: ["wifi", "ac", "tables_chairs", "power_backup"],
    allowed_purposes: ["study", "meeting"],
    rules: [
      { text: "Maintain whisper silence in adjoining corridor" },
      { text: "No outside food allowed inside study area" }
    ],
    photos: [
      { url: "/images/spaces/small-room-1.jpg", caption: "Reading and conference room" }
    ],
    verified: true,
    rating: 4.7,
    review_count: 31,
    hygiene_score: 9,
    slots: [
      { label: "Morning", start: "09:00", end: "13:00" },
      { label: "Afternoon", start: "14:00", end: "18:00" }
    ]
  },
  {
    id: "SP-010",
    owner_id: "USR-004",
    name: "Lokmanya Equipment Storeroom",
    description: "Compact lockup room suitable for festival decorations, community sports gear, and staging props.",
    address: "Lokmanya Seva Sangh, Ground Floor, Sector 3, Sanpada",
    area: "Sanpada, Navi Mumbai",
    space_type: "storeroom",
    indoor_outdoor: "indoor",
    capacity: 8,
    price_per_hour: 120,
    deposit_amount: 800,
    min_duration_hours: 2,
    facilities: ["lockable_door", "ground_floor_access"],
    allowed_purposes: ["storage"],
    rules: [
      { text: "Stack boxes neatly against marked perimeter" },
      { text: "Ensure lights are turned off and deadbolt secured" }
    ],
    photos: [
      { url: "/images/spaces/storeroom-1.jpg", caption: "Lockable storeroom bay" }
    ],
    verified: true,
    rating: 4.5,
    review_count: 12,
    hygiene_score: 8,
    slots: [
      { label: "Access Slot", start: "09:00", end: "18:00" }
    ]
  }
];

// Bookings
const mockBookings = [
  {
    id: "BK-1001",
    ref: "#BK-1001",
    user_id: "USR-001",
    space_id: "SP-002",
    slot_date: getRelativeDate(1, 9, 0), // Tomorrow
    start_time: "09:00",
    end_time: "13:00",
    duration_hours: 4,
    status: "approved", // Active booking #1 for Priya
    purpose: "Neighborhood Music Rehearsal",
    group_size: 35,
    hourly_rate: 800,
    hourly_fee: 3200,
    deposit_amount: 2500,
    deposit_status: "held",
    total_paid: 5700,
    platform_fee: 256,
    net_payout: 2944,
    payment_method: "upi",
    payment_status: "paid",
    paid_at: getRelativeDate(-2, 14, 21),
    decision_reason: "Approved. Please maintain acoustic panels in corner and keep volume below 65dB.",
    pin_code: "9214",
    cancellation_deadline: getRelativeDate(1, 7, 0), // 2 hours before start
    can_cancel: true,
    cancel_warning: null
  },
  {
    id: "BK-1002",
    ref: "#BK-1002",
    user_id: "USR-002",
    space_id: "SP-001",
    slot_date: getRelativeDate(0, 9, 0), // Today
    start_time: "09:00",
    end_time: "13:00",
    duration_hours: 4,
    status: "approved", // Check-in due today on Rajesh's space SP-001
    purpose: "Inter-Society Cricket Match",
    group_size: 25,
    hourly_rate: 500,
    hourly_fee: 2000,
    deposit_amount: 2000,
    deposit_status: "held",
    total_paid: 4000,
    platform_fee: 160,
    net_payout: 1840,
    payment_method: "upi",
    payment_status: "paid",
    paid_at: getRelativeDate(-1, 10, 0),
    decision_reason: "Approved. Return all boundary markers to ground keeper.",
    pin_code: "4402",
    cancellation_deadline: getRelativeDate(0, 7, 0),
    can_cancel: false,
    cancel_warning: "Less than 2 hours before session start"
  },
  {
    id: "BK-1003",
    ref: "#BK-1003",
    user_id: "USR-007", // Ananya Iyer (Tier 1)
    space_id: "SP-002",
    slot_date: getRelativeDate(3, 10, 0),
    start_time: "10:00",
    end_time: "14:00",
    duration_hours: 4,
    status: "requested", // Pending request in Rajesh's queue
    purpose: "Classical Music Workshop",
    group_size: 40,
    hourly_rate: 800,
    hourly_fee: 3200,
    deposit_amount: 2500,
    deposit_status: "held",
    total_amount: 5700,
    total_paid: 0,
    platform_fee: 256,
    net_payout: 2944,
    payment_method: "pay_at_venue",
    payment_status: "pending",
    paid_at: null,
    decision_reason: null,
    pin_code: null,
    notes: "Microphone stand and 40 chairs required"
  },
  {
    id: "BK-1004",
    ref: "#BK-1004",
    user_id: "USR-006", // Rohan Desai (Tier 3)
    space_id: "SP-002", // On Rajesh's space SP-002
    slot_date: getRelativeDate(0, 8, 0), // Today
    start_time: "08:00",
    end_time: "12:00",
    duration_hours: 4,
    status: "overdue", // 35 minutes overdue
    purpose: "Chess Guild Tournament",
    group_size: 20,
    hourly_rate: 800,
    hourly_fee: 3200,
    deposit_amount: 2500,
    deposit_status: "held",
    total_paid: 5700,
    platform_fee: 256,
    net_payout: 2944,
    payment_method: "card",
    payment_status: "paid",
    paid_at: getRelativeDate(-1, 15, 0),
    decision_reason: "Approved with reminder to clear trash.",
    pin_code: "7410",
    condition_notes: "35 minutes overdue. Hall unlocked but organizer absent."
  },
  {
    id: "BK-1005",
    ref: "#BK-1005",
    user_id: "USR-002", // Aarav Sharma
    space_id: "SP-001", // On Rajesh's space SP-001
    slot_date: getRelativeDate(-1, 10, 0),
    start_time: "10:00",
    end_time: "14:00",
    duration_hours: 4,
    status: "damaged", // Under active incident review
    purpose: "Food Festival Stalls",
    group_size: 80,
    hourly_rate: 500,
    hourly_fee: 2000,
    deposit_amount: 2000,
    deposit_status: "held",
    total_paid: 4000,
    platform_fee: 160,
    net_payout: 1840,
    payment_method: "upi",
    payment_status: "paid",
    paid_at: getRelativeDate(-3, 11, 0),
    decision_reason: "Approved for stalls.",
    pin_code: "5512"
  },
  {
    id: "BK-1006",
    ref: "#BK-1006",
    user_id: "USR-001", // Priya Mehta
    space_id: "SP-001",
    slot_date: getRelativeDate(-12, 8, 0),
    start_time: "08:00",
    end_time: "12:00",
    duration_hours: 4,
    status: "returned", // Clean return +5
    purpose: "Weekend Cricket Match",
    group_size: 22,
    hourly_rate: 500,
    hourly_fee: 2000,
    deposit_amount: 2000,
    deposit_status: "refunded",
    total_paid: 4000,
    platform_fee: 160,
    net_payout: 1840,
    payment_method: "card",
    payment_status: "paid",
    paid_at: getRelativeDate(-14, 9, 0),
    decision_reason: "Approved. Enjoy your match.",
    pin_code: "1289"
  },
  {
    id: "BK-1007",
    ref: "#BK-1007",
    user_id: "USR-007", // Ananya Iyer
    space_id: "SP-003",
    slot_date: getRelativeDate(-20, 17, 0),
    start_time: "17:00",
    end_time: "20:00",
    duration_hours: 3,
    status: "closed", // Fully settled
    purpose: "Track & Field Coaching",
    group_size: 15,
    hourly_rate: 400,
    hourly_fee: 1200,
    deposit_amount: 1500,
    deposit_status: "refunded",
    total_paid: 2700,
    platform_fee: 96,
    net_payout: 1104,
    payment_method: "net_banking",
    payment_status: "paid",
    paid_at: getRelativeDate(-22, 10, 0),
    decision_reason: "Approved for coaching.",
    pin_code: "8841"
  },
  {
    id: "BK-1008",
    ref: "#BK-1008",
    user_id: "USR-006", // Rohan Desai
    space_id: "SP-001",
    slot_date: getRelativeDate(-8, 9, 0),
    start_time: "09:00",
    end_time: "13:00",
    duration_hours: 4,
    status: "cancelled", // Neutral grey badge
    purpose: "Rescheduled sports day",
    group_size: 30,
    hourly_rate: 500,
    hourly_fee: 2000,
    deposit_amount: 2000,
    deposit_status: "refunded",
    total_paid: 0,
    platform_fee: 0,
    net_payout: 0,
    payment_method: "upi",
    payment_status: "refunded",
    paid_at: null,
    decision_reason: "Cancelled by user 24h prior to start.",
    pin_code: null
  },
  {
    id: "BK-1009",
    ref: "#BK-1009",
    user_id: "USR-002", // Aarav Sharma (Tier 2, score 75)
    space_id: "SP-002",
    slot_date: getRelativeDate(4, 14, 0),
    start_time: "14:00",
    end_time: "18:00",
    duration_hours: 4,
    status: "requested", // Tier 2 pending request for Rajesh
    purpose: "Society Drama Rehearsal",
    group_size: 30,
    hourly_rate: 800,
    hourly_fee: 3200,
    deposit_amount: 2500,
    deposit_status: "held",
    total_paid: 5700,
    platform_fee: 256,
    net_payout: 2944,
    payment_method: "upi",
    payment_status: "paid",
    paid_at: getRelativeDate(-1, 16, 0),
    decision_reason: null,
    pin_code: null,
    notes: "Requires stage lighting access"
  },
  {
    id: "BK-1010",
    ref: "#BK-1010",
    user_id: "USR-006", // Rohan Desai (Tier 3, score 45)
    space_id: "SP-002",
    slot_date: getRelativeDate(5, 10, 0),
    start_time: "10:00",
    end_time: "14:00",
    duration_hours: 4,
    status: "requested", // Tier 3 pending request with strong owner advisory warning
    purpose: "Community Robotics Club",
    group_size: 18,
    hourly_rate: 800,
    hourly_fee: 3200,
    deposit_amount: 2500,
    deposit_status: "held",
    total_paid: 5700,
    platform_fee: 256,
    net_payout: 2944,
    payment_method: "card",
    payment_status: "paid",
    paid_at: getRelativeDate(0, 11, 0),
    decision_reason: null,
    pin_code: null,
    notes: "Power strips needed for laptop chargers"
  },
  {
    id: "BK-1011",
    ref: "#BK-1011",
    user_id: "USR-008", // Meera Nair (Tier 1)
    space_id: "SP-002",
    slot_date: getRelativeDate(4, 14, 0), // Exactly overlaps BK-1009 for calendar conflict matrix!
    start_time: "14:00",
    end_time: "18:00",
    duration_hours: 4,
    status: "requested",
    purpose: "Neighborhood Art Exhibition",
    group_size: 25,
    hourly_rate: 800,
    hourly_fee: 3200,
    deposit_amount: 2500,
    deposit_status: "held",
    total_paid: 5700,
    platform_fee: 256,
    net_payout: 2944,
    payment_method: "upi",
    payment_status: "paid",
    paid_at: getRelativeDate(-1, 17, 0),
    decision_reason: null,
    pin_code: null,
    notes: "Display easels needed"
  }
];

// Waitlist
const mockWaitlist = [
  {
    id: "WL-201",
    space_id: "SP-002",
    slot_id: "SLOT-101",
    slot_date: getRelativeDate(1, 9, 0),
    user_id: "USR-002",
    user_name: "Aarav Sharma",
    position: 1, // FIFO #1
    created_at: getRelativeDate(-1, 14, 0)
  }
];

// Incidents
const mockIncidents = [
  {
    id: "INC-501",
    booking_id: "BK-1005",
    ref: "#INC-501",
    space_id: "SP-001",
    space_name: "Shanti Niketan Community Ground",
    user_id: "USR-002",
    user_name: "Aarav Sharma",
    user_initials: "AS",
    user_tier: 2,
    user_score: 75,
    date: getRelativeDate(-1, 14, 5),
    description: "Deep tire tracks on turf pitch and broken gate padlock",
    timeline: [
      { time: "13:00", event: "Scheduled checkout deadline" },
      { time: "13:40", event: "Gate inspection by owner Rajesh Kumar" },
      { time: "13:50", event: "Damage discovered: turf tire ruts and damaged padlock" }
    ],
    photos: [
      { url: "/images/spaces/community-ground-1.jpg", caption: "Turf surface rut", timestamp: "13:52 UTC" }
    ],
    deposit_held: 2000,
    deductions: [
      { label: "Turf Re-levelling & Grass Seed", detail: "Professional turf repair callout", amount: 800 },
      { label: "Gate Padlock & Hasp Replacement", detail: "Heavy-duty brass padlock", amount: 400 }
    ],
    total_deductions: 1200,
    refund_amount: 800, // 2000 - 1200 = 800 reconciled
    score_penalty: -30, // flat -30 for damage
    status: "pending"
  },
  {
    id: "INC-499",
    booking_id: "BK-1007", // References closed booking BK-1007
    ref: "#INC-499",
    space_id: "SP-002",
    space_name: "Gulmohar Society Hall",
    user_id: "USR-006",
    user_name: "Rohan Desai",
    reason: "Broken switchboard faceplate",
    deposit_amount: 2500,
    deduction_amount: 500,
    refund_amount: 2000,
    score_delta: -30,
    status: "Finalized",
    date: getRelativeDate(-7, 0, 0)
  }
];

// Disputes
const mockDisputes = [
  {
    id: "DSP-001",
    booking_id: "BK-1004",
    user_id: "USR-006",
    user_name: "Rohan Desai",
    space_name: "Gulmohar Society Hall",
    score_impact: -10,
    reason: "Late return due to electrical lock jam, key handover delayed by on-site watchman",
    filed_at: getRelativeDate(-1, 15, 0),
    status: "open"
  }
];

// Notifications
const mockNotifications = [
  // User notifications for Priya (USR-001)
  {
    id: "NTF-302",
    recipient_id: "USR-001",
    type: "booking_approved",
    title: "Gulmohar Society Hall Confirmed",
    message: "Your booking for tomorrow at 09:00 AM was approved by Rajesh Kumar. Access code will be available 1 hour before scheduled start.",
    read: false,
    created_at: getRelativeDate(-2, 14, 21),
    actions: [
      { label: "View Receipt", href: "/bookings/BK-1001/receipt", style: "primary" },
      { label: "View Booking", href: "/my-bookings", style: "secondary" }
    ]
  },
  {
    id: "NTF-303",
    recipient_id: "USR-001",
    type: "reminder",
    title: "Upcoming Session Tomorrow",
    message: "Gulmohar Society Hall session starts tomorrow at 09:00 AM.",
    read: true,
    created_at: getRelativeDate(-1, 10, 0),
    actions: []
  },
  {
    id: "NTF-304",
    recipient_id: "USR-001",
    type: "score_credit",
    title: "+5 Reliability Points Credited",
    message: "On-time clean return confirmed for Shanti Niketan Community Ground.",
    read: true,
    created_at: getRelativeDate(-12, 14, 35),
    actions: [{ label: "View Score", href: "/my-score", style: "secondary" }]
  },

  // Owner notifications for Rajesh (USR-003)
  {
    id: "NTF-305",
    recipient_id: "USR-003",
    type: "new_request",
    title: "New Booking Request Received",
    message: "Ananya Iyer requested Gulmohar Society Hall for Classical Music Workshop.",
    read: false,
    created_at: getRelativeDate(0, 10, 0),
    actions: [{ label: "Review Request", href: "/owner/requests", style: "primary" }]
  },
  {
    id: "NTF-306",
    recipient_id: "USR-003",
    type: "overdue",
    title: "Overdue Return Alert: #BK-1004",
    message: "Rohan Desai has exceeded the checkout deadline on Gulmohar Society Hall by 35 minutes.",
    read: false,
    created_at: getRelativeDate(0, 12, 35),
    actions: [{ label: "Inspect Return", href: "/owner/today", style: "primary" }]
  },
  {
    id: "NTF-307",
    recipient_id: "USR-003",
    type: "incident",
    title: "Incident Logged for Shanti Niketan Ground",
    message: "Turf tire ruts and broken padlock reported on #BK-1005.",
    read: false,
    created_at: getRelativeDate(-1, 14, 10),
    actions: [{ label: "View Incident", href: "/owner/incidents", style: "primary" }]
  }
];

// Audit Log (10 entries)
const mockAuditLog = [
  {
    id: "AUD-901",
    timestamp: getRelativeDate(0, 12, 35),
    actor: "System",
    action: "flag_overdue",
    target: "Booking #BK-1004",
    reason: "Scheduled slot exceeded by 15 mins without extension",
    details: "Space: Gulmohar Society Hall"
  },
  {
    id: "AUD-902",
    timestamp: getRelativeDate(-1, 15, 0),
    actor: "Rohan Desai (User)",
    action: "file_dispute",
    target: "Dispute #DSP-001",
    reason: "Late return contested due to watchman delay",
    details: "Score impact -10"
  },
  {
    id: "AUD-903",
    timestamp: getRelativeDate(-1, 14, 10),
    actor: "Rajesh Kumar (Owner)",
    action: "flag_incident",
    target: "Incident #INC-501",
    reason: "Turf surface tire ruts and broken padlock discovered at return",
    details: "Space: Shanti Niketan Ground"
  },
  {
    id: "AUD-904",
    timestamp: getRelativeDate(-2, 14, 21),
    actor: "Rajesh Kumar (Owner)",
    action: "approve_booking",
    target: "Booking #BK-1001",
    reason: "Approved music rehearsal with noise guidelines",
    details: "Space: Gulmohar Society Hall"
  },
  {
    id: "AUD-905",
    timestamp: getRelativeDate(-2, 14, 20),
    actor: "Priya Mehta (User)",
    action: "create_booking",
    target: "Booking #BK-1001",
    reason: "Neighborhood Music Rehearsal",
    details: "Demo payment: UPI"
  },
  {
    id: "AUD-906",
    timestamp: getRelativeDate(-6, 11, 0),
    actor: "Amit Verma (Admin)",
    action: "verify_owner",
    target: "User #USR-004",
    reason: "Property deeds and identification verified",
    details: "Vikram Malhotra"
  },
  {
    id: "AUD-907",
    timestamp: getRelativeDate(-8, 9, 30),
    actor: "Rohan Desai (User)",
    action: "cancel_booking",
    target: "Booking #BK-1008",
    reason: "Rescheduled sports day with 24h advance notice",
    details: "Space: Shanti Niketan Ground"
  },
  {
    id: "AUD-908",
    timestamp: getRelativeDate(-11, 16, 0),
    actor: "Sunita Rao (Owner)",
    action: "submit_owner_verification",
    target: "User #USR-005",
    reason: "Aadhaar and tax documents uploaded",
    details: "Status pending administrative review"
  },
  {
    id: "AUD-909",
    timestamp: getRelativeDate(-12, 14, 35),
    actor: "Rajesh Kumar (Owner)",
    action: "return_space",
    target: "Booking #BK-1006",
    reason: "Clean on-time return confirmed",
    details: "+5 reliability score awarded"
  },
  {
    id: "AUD-910",
    timestamp: getRelativeDate(-16, 10, 0),
    actor: "Amit Verma (Admin)",
    action: "update_settings",
    target: "Fairness Settings",
    reason: "Updated cancellation penalty threshold to 2 hours",
    details: "System configuration update"
  }
];

// Score Events Ledger
const mockScoreEvents = [
  {
    id: "SE-101",
    user_id: "USR-001",
    booking_id: "BK-1006",
    delta: -10,
    reason: "Late return past 15 min grace window",
    created_at: getRelativeDate(-12, 14, 35)
  },
  {
    id: "SE-102",
    user_id: "USR-001",
    booking_id: "BK-1007",
    delta: 5,
    reason: "Clean and on-time space handover verified",
    created_at: getRelativeDate(-5, 13, 0)
  },
  {
    id: "SE-103",
    user_id: "USR-002",
    booking_id: "BK-1005",
    delta: -30,
    reason: "Confirmed property damage during return inspection",
    created_at: getRelativeDate(-1, 14, 10)
  },
  {
    id: "SE-104",
    user_id: "USR-002",
    booking_id: "BK-1003",
    delta: 5,
    reason: "Pristine condition return on sports ground",
    created_at: getRelativeDate(-10, 12, 0)
  },
  {
    id: "SE-105",
    user_id: "USR-006",
    booking_id: "BK-1007",
    delta: -30,
    reason: "Broken electrical faceplate and fixtures",
    created_at: getRelativeDate(-7, 16, 0)
  },
  {
    id: "SE-106",
    user_id: "USR-006",
    booking_id: "BK-1004",
    delta: -15,
    reason: "Unreported late checkout by 45 minutes",
    created_at: getRelativeDate(-15, 11, 0)
  },
  {
    id: "SE-107",
    user_id: "USR-006",
    booking_id: "BK-1008",
    delta: -10,
    reason: "Untidy premises and litter left behind",
    created_at: getRelativeDate(-20, 18, 0)
  },
  {
    id: "SE-108",
    user_id: "USR-007",
    booking_id: "BK-1002",
    delta: 5,
    reason: "Spotless handover and early lock-up",
    created_at: getRelativeDate(-4, 15, 0)
  }
];

// Condition Reports
const mockConditionReports = [
  {
    id: "CR-201",
    space_id: "SP-001",
    booking_id: "BK-1005",
    stage: "closing",
    cleanliness: "damaged",
    notes: "Turf tire tracks near east boundary and bent gate padlock hasp.",
    created_at: getRelativeDate(-1, 14, 10)
  },
  {
    id: "CR-202",
    space_id: "SP-002",
    booking_id: "BK-1006",
    stage: "closing",
    cleanliness: "acceptable",
    notes: "Acoustic foam neatly stacked, lights turned off, returned 20m late.",
    created_at: getRelativeDate(-12, 14, 35)
  },
  {
    id: "CR-203",
    space_id: "SP-002",
    booking_id: "BK-1001",
    stage: "opening",
    cleanliness: "spotless",
    notes: "Floor swept, sound mixer tested, restroom supplies replenished.",
    created_at: getRelativeDate(0, 8, 30)
  }
];

// Dynamic computation helpers
function computeUserScore(userId) {
  const events = mockScoreEvents.filter(e => e.user_id === userId);
  const sumDelta = events.reduce((sum, e) => sum + (e.delta || 0), 0);
  return Math.min(120, Math.max(0, 100 + sumDelta));
}

function computeUserActiveBookings(userId) {
  const activeStatuses = ['requested', 'approved', 'checked_in', 'overdue'];
  return mockBookings.filter(b => b.user_id === userId && activeStatuses.includes(b.status)).length;
}

// Compute dynamic user scores and active bookings from arrays
mockUsers.forEach(user => {
  user.score = computeUserScore(user.id);
  user.active_bookings_count = computeUserActiveBookings(user.id);
  user.active_bookings = user.active_bookings_count;
  user.tier = user.score >= 80 ? 1 : (user.score >= 50 ? 2 : 3);
});

// Reconcile incidents data
mockIncidents.forEach(inc => {
  inc.deduction_total = inc.total_deductions || (inc.deductions ? inc.deductions.reduce((s, d) => s + d.amount, 0) : inc.deduction_amount || 0);
  inc.total_deductions = inc.deduction_total;
  inc.deposit_held = inc.deposit_held || inc.deposit_amount || 0;
  inc.refund_amount = inc.deposit_held - inc.deduction_total;
  if (inc.status === 'pending') inc.status = 'open';
});

// Reconcile booking aliases
mockBookings.forEach(b => {
  b.hourly_fee_total = b.hourly_fee_total || b.hourly_fee;
  b.total_amount = b.total_amount || (b.hourly_fee && b.deposit_amount ? (b.hourly_fee + b.deposit_amount) : b.total_paid);
  b.access_pin = b.access_pin || b.pin_code;
  b.space = mockSpaces.find(s => s.id === b.space_id);
  b.user = mockUsers.find(u => u.id === b.user_id);
});

function getUserById(id) {
  return mockUsers.find(u => u.id === id);
}

function getSpaceById(id) {
  return mockSpaces.find(s => s.id === id);
}

function getBookingById(id) {
  const b = mockBookings.find(b => b.id === id || b.ref === id);
  if (!b) return null;
  const space = getSpaceById(b.space_id);
  const user = getUserById(b.user_id);
  return {
    ...b,
    space,
    user,
    hourly_fee_total: b.hourly_fee_total || b.hourly_fee,
    total_amount: b.total_amount || b.total_paid,
    access_pin: b.access_pin || b.pin_code
  };
}

// Helper calculations
function computeAdminCounts() {
  const activeBookings = mockBookings.filter(b => ['requested', 'approved', 'checked_in', 'overdue'].includes(b.status)).length;
  const completedBookings = mockBookings.filter(b => ['completed', 'cancelled', 'closed', 'returned'].includes(b.status)).length;
  const pendingOwners = mockUsers.filter(u => u.role === 'owner' && u.status === 'pending').length;
  const totalOwners = mockUsers.filter(u => u.role === 'owner').length;
  const totalUsers = mockUsers.filter(u => u.role === 'user').length;
  const totalVolume = mockBookings.reduce((sum, b) => sum + (b.total_amount || b.total_paid || 0), 0);

  return {
    total_users: totalUsers,
    total_owners: totalOwners,
    pending_owners: pendingOwners,
    total_spaces: mockSpaces.length,
    active_bookings: activeBookings,
    completed_bookings: completedBookings,
    open_disputes: mockDisputes.filter(d => d.status === 'open').length,
    active_incidents: mockIncidents.filter(i => i.status === 'open' || i.status === 'pending').length,
    total_incidents: mockIncidents.length,
    total_volume: totalVolume
  };
}

module.exports = {
  USE_MOCK,
  getRelativeDate,
  getRelativeDateString,
  settings: mockSettings,
  users: mockUsers,
  spaces: mockSpaces,
  bookings: mockBookings,
  waitlist: mockWaitlist,
  incidents: mockIncidents,
  disputes: mockDisputes,
  notifications: mockNotifications,
  auditLog: mockAuditLog,
  scoreEvents: mockScoreEvents,
  conditionReports: mockConditionReports,
  getUserById,
  getSpaceById,
  getBookingById,
  computeAdminCounts,
  computeUserScore,
  computeUserActiveBookings
};
