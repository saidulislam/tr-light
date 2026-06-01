import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client.ts";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

// ─── Reporting structure ─────────────────────────────────────────────────────
// Flat list of every person in the org with their manager (by email).
// All other fields are filled with realistic example values below.

type Rating = "STAND_OUT" | "ACHIEVER" | "NEEDS_IMPROVEMENT";

interface OrgRow {
  email: string;
  name: string;
  title: string;
  grade: string;
  managerEmail: string | null;
  // Filler overrides; if omitted, sensible defaults are derived from grade.
  city?: string;
  country?: string;
  tenureYears?: number;
  priorRating2024?: Rating;
  priorRating2025?: Rating;
  codeContributions?: number;
  aiUsagePercent?: number;
  /** Override the grade-derived default — needed for ICs sitting at the same
   *  grade as managers (Principal Engineer / Tech Lead). */
  jobFamily?: string;
}

const ORG: OrgRow[] = [
  // Top
  { email: "john.doe@acme.com", name: "John Doe", title: "Managing Director", grade: "605", managerEmail: null,
    city: "New York", country: "USA", tenureYears: 14.5, priorRating2024: "STAND_OUT", priorRating2025: "STAND_OUT" },

  // Reports to MD
  { email: "rue.oberi@acme.com", name: "Rue Oberi", title: "Engineering Director", grade: "604.1", managerEmail: "john.doe@acme.com",
    city: "London", country: "UK", tenureYears: 9.8, priorRating2024: "ACHIEVER", priorRating2025: "STAND_OUT" },
  { email: "jessica.morales@acme.com", name: "Jessica Morales", title: "Engineering Director", grade: "604.1", managerEmail: "john.doe@acme.com",
    city: "Austin", country: "USA", tenureYears: 8.2, priorRating2024: "ACHIEVER", priorRating2025: "ACHIEVER" },
  { email: "robert.marzetti@acme.com", name: "Robert Marzetti", title: "Senior Engineering Director", grade: "604.2", managerEmail: "john.doe@acme.com",
    city: "San Francisco", country: "USA", tenureYears: 11.1, priorRating2024: "STAND_OUT", priorRating2025: "ACHIEVER" },
  { email: "rick.mojave@acme.com", name: "Rick Mojave", title: "Senior VP", grade: "603.2", managerEmail: "john.doe@acme.com",
    city: "Toronto", country: "Canada", tenureYears: 7.4, priorRating2024: "ACHIEVER", priorRating2025: "ACHIEVER" },
  { email: "jane.kruznetz@acme.com", name: "Jane Kruznetz", title: "Senior VP", grade: "603.2", managerEmail: "john.doe@acme.com",
    city: "Berlin", country: "Germany", tenureYears: 6.7, priorRating2024: "ACHIEVER", priorRating2025: "STAND_OUT" },

  // Under Rue Oberi — includes one IC (Principal Engineer) on the technical track
  { email: "aaron.yamamoto@acme.com", name: "Aaron Yamamoto", title: "Principal Engineer", grade: "603.2", managerEmail: "rue.oberi@acme.com",
    city: "Seattle", country: "USA", tenureYears: 11.3, priorRating2024: "STAND_OUT", priorRating2025: "STAND_OUT",
    codeContributions: 487, aiUsagePercent: 89, jobFamily: "Software Engineering" },
  { email: "laura.sanchez@acme.com", name: "Laura Sanchez", title: "VP", grade: "603.1", managerEmail: "rue.oberi@acme.com",
    city: "Hyderabad", country: "India", tenureYears: 6.4, priorRating2024: "STAND_OUT", priorRating2025: "ACHIEVER" },
  { email: "mobi.lawrence@acme.com", name: "Mobi Lawrence", title: "VP", grade: "603.1", managerEmail: "rue.oberi@acme.com",
    city: "Dublin", country: "Ireland", tenureYears: 5.9, priorRating2024: "ACHIEVER", priorRating2025: "ACHIEVER" },
  { email: "joy.rohan@acme.com", name: "Joy Rohan", title: "Senior VP", grade: "603.2", managerEmail: "rue.oberi@acme.com",
    city: "Bangalore", country: "India", tenureYears: 8.0, priorRating2024: "STAND_OUT", priorRating2025: "STAND_OUT" },
  { email: "tony.alvarez@acme.com", name: "Tony Alvarez", title: "Senior VP", grade: "603.2", managerEmail: "rue.oberi@acme.com",
    city: "Mumbai", country: "India", tenureYears: 7.2, priorRating2024: "ACHIEVER", priorRating2025: "ACHIEVER" },

  // Laura Sanchez's team
  { email: "marcus.bennett@acme.com", name: "Marcus Bennett", title: "Senior Software Engineer", grade: "602", managerEmail: "laura.sanchez@acme.com",
    city: "Hyderabad", country: "India", tenureYears: 4.4, priorRating2024: "ACHIEVER", priorRating2025: "STAND_OUT", codeContributions: 391, aiUsagePercent: 92 },
  { email: "priya.nair@acme.com", name: "Priya Nair", title: "Senior Software Engineer", grade: "602", managerEmail: "laura.sanchez@acme.com",
    city: "Bangalore", country: "India", tenureYears: 3.7, priorRating2024: "ACHIEVER", priorRating2025: "ACHIEVER", codeContributions: 312, aiUsagePercent: 78 },
  { email: "hannah.whitaker@acme.com", name: "Hannah Whitaker", title: "Software Engineer II", grade: "601", managerEmail: "laura.sanchez@acme.com",
    city: "London", country: "UK", tenureYears: 2.1, priorRating2024: "ACHIEVER", priorRating2025: "ACHIEVER", codeContributions: 248, aiUsagePercent: 65 },
  { email: "arjun.deshmukh@acme.com", name: "Arjun Deshmukh", title: "Software Engineer II", grade: "601", managerEmail: "laura.sanchez@acme.com",
    city: "Pune", country: "India", tenureYears: 1.8, priorRating2024: "ACHIEVER", priorRating2025: "STAND_OUT", codeContributions: 285, aiUsagePercent: 88 },
  { email: "elena.castillo@acme.com", name: "Elena Castillo", title: "Software Engineer I", grade: "502", managerEmail: "laura.sanchez@acme.com",
    city: "New York", country: "USA", tenureYears: 0.9, priorRating2024: "ACHIEVER", priorRating2025: "ACHIEVER", codeContributions: 142, aiUsagePercent: 95 },

  // Mobi Lawrence's team
  { email: "daniel.foster@acme.com", name: "Daniel Foster", title: "Senior Software Engineer", grade: "602", managerEmail: "mobi.lawrence@acme.com",
    city: "Dublin", country: "Ireland", tenureYears: 5.0, priorRating2024: "ACHIEVER", priorRating2025: "ACHIEVER", codeContributions: 268, aiUsagePercent: 71 },
  { email: "ananya.krishnan@acme.com", name: "Ananya Krishnan", title: "Software Engineer II", grade: "601", managerEmail: "mobi.lawrence@acme.com",
    city: "Bangalore", country: "India", tenureYears: 2.5, priorRating2024: "ACHIEVER", priorRating2025: "STAND_OUT", codeContributions: 322, aiUsagePercent: 84 },
  { email: "rebecca.lawson@acme.com", name: "Rebecca Lawson", title: "Software Engineer I", grade: "502", managerEmail: "mobi.lawrence@acme.com",
    city: "Austin", country: "USA", tenureYears: 1.2, priorRating2024: "ACHIEVER", priorRating2025: "NEEDS_IMPROVEMENT", codeContributions: 95, aiUsagePercent: 42 },
  { email: "vikram.iyer@acme.com", name: "Vikram Iyer", title: "Senior Software Engineer", grade: "602", managerEmail: "mobi.lawrence@acme.com",
    city: "Hyderabad", country: "India", tenureYears: 6.1, priorRating2024: "STAND_OUT", priorRating2025: "STAND_OUT", codeContributions: 415, aiUsagePercent: 90 },
  { email: "olivia.reyes@acme.com", name: "Olivia Reyes", title: "Software Engineer I", grade: "502", managerEmail: "mobi.lawrence@acme.com",
    city: "Toronto", country: "Canada", tenureYears: 0.6, priorRating2024: "ACHIEVER", priorRating2025: "ACHIEVER", codeContributions: 68, aiUsagePercent: 100 },

  // Joy Rohan's team
  { email: "nathan.brooks@acme.com", name: "Nathan Brooks", title: "Senior Software Engineer", grade: "602", managerEmail: "joy.rohan@acme.com",
    city: "London", country: "UK", tenureYears: 4.8, priorRating2024: "ACHIEVER", priorRating2025: "ACHIEVER", codeContributions: 301, aiUsagePercent: 67 },
  { email: "meera.pillai@acme.com", name: "Meera Pillai", title: "Software Engineer II", grade: "601", managerEmail: "joy.rohan@acme.com",
    city: "Bangalore", country: "India", tenureYears: 2.9, priorRating2024: "ACHIEVER", priorRating2025: "STAND_OUT", codeContributions: 278, aiUsagePercent: 83 },
  { email: "samantha.cole@acme.com", name: "Samantha Cole", title: "Software Engineer I", grade: "502", managerEmail: "joy.rohan@acme.com",
    city: "San Francisco", country: "USA", tenureYears: 1.4, priorRating2024: "NEEDS_IMPROVEMENT", priorRating2025: "ACHIEVER", codeContributions: 178, aiUsagePercent: 72 },
  { email: "rohan.malhotra@acme.com", name: "Rohan Malhotra", title: "Software Engineer II", grade: "601", managerEmail: "joy.rohan@acme.com",
    city: "Mumbai", country: "India", tenureYears: 3.1, priorRating2024: "ACHIEVER", priorRating2025: "ACHIEVER", codeContributions: 245, aiUsagePercent: 76 },
  { email: "grace.sullivan@acme.com", name: "Grace Sullivan", title: "Software Engineer I", grade: "502", managerEmail: "joy.rohan@acme.com",
    city: "Dublin", country: "Ireland", tenureYears: 0.5, priorRating2024: "ACHIEVER", priorRating2025: "ACHIEVER", codeContributions: 52, aiUsagePercent: 98 },
  { email: "karthik.subramanian@acme.com", name: "Karthik Subramanian", title: "Senior Software Engineer", grade: "602", managerEmail: "joy.rohan@acme.com",
    city: "Hyderabad", country: "India", tenureYears: 5.6, priorRating2024: "STAND_OUT", priorRating2025: "ACHIEVER", codeContributions: 355, aiUsagePercent: 81 },

  // Tony Alvarez's team
  { email: "ethan.caldwell@acme.com", name: "Ethan Caldwell", title: "Senior Software Engineer", grade: "602", managerEmail: "tony.alvarez@acme.com",
    city: "Austin", country: "USA", tenureYears: 4.3, priorRating2024: "ACHIEVER", priorRating2025: "ACHIEVER", codeContributions: 289, aiUsagePercent: 70 },
  { email: "divya.menon@acme.com", name: "Divya Menon", title: "Software Engineer II", grade: "601", managerEmail: "tony.alvarez@acme.com",
    city: "Bangalore", country: "India", tenureYears: 2.6, priorRating2024: "ACHIEVER", priorRating2025: "STAND_OUT", codeContributions: 308, aiUsagePercent: 86 },
  { email: "madison.hayes@acme.com", name: "Madison Hayes", title: "Software Engineer I", grade: "502", managerEmail: "tony.alvarez@acme.com",
    city: "Toronto", country: "Canada", tenureYears: 1.3, priorRating2024: "ACHIEVER", priorRating2025: "ACHIEVER", codeContributions: 165, aiUsagePercent: 79 },
  { email: "aditya.kapoor@acme.com", name: "Aditya Kapoor", title: "Software Engineer II", grade: "601", managerEmail: "tony.alvarez@acme.com",
    city: "Pune", country: "India", tenureYears: 3.4, priorRating2024: "ACHIEVER", priorRating2025: "ACHIEVER", codeContributions: 220, aiUsagePercent: 64 },
  { email: "lauren.mitchell@acme.com", name: "Lauren Mitchell", title: "Software Engineer I", grade: "502", managerEmail: "tony.alvarez@acme.com",
    city: "London", country: "UK", tenureYears: 0.8, priorRating2024: "ACHIEVER", priorRating2025: "ACHIEVER", codeContributions: 88, aiUsagePercent: 96 },
  { email: "sanjay.venkatesh@acme.com", name: "Sanjay Venkatesh", title: "Senior Software Engineer", grade: "602", managerEmail: "tony.alvarez@acme.com",
    city: "Mumbai", country: "India", tenureYears: 5.2, priorRating2024: "ACHIEVER", priorRating2025: "STAND_OUT", codeContributions: 376, aiUsagePercent: 88 },

  // Under Jessica Morales — includes one IC (Tech Lead) on the technical track
  { email: "sophia.lindberg@acme.com", name: "Sophia Lindberg", title: "Tech Lead", grade: "603.1", managerEmail: "jessica.morales@acme.com",
    city: "Stockholm", country: "Sweden", tenureYears: 7.6, priorRating2024: "ACHIEVER", priorRating2025: "STAND_OUT",
    codeContributions: 362, aiUsagePercent: 86, jobFamily: "Software Engineering" },
  { email: "priya.sundaram@acme.com", name: "Priya Sundaram", title: "Senior VP", grade: "603.2", managerEmail: "jessica.morales@acme.com",
    city: "Singapore", country: "Singapore", tenureYears: 7.8, priorRating2024: "STAND_OUT", priorRating2025: "STAND_OUT" },

  // Priya Sundaram's team
  { email: "tyler.donovan@acme.com", name: "Tyler Donovan", title: "Senior Software Engineer", grade: "602", managerEmail: "priya.sundaram@acme.com",
    city: "Singapore", country: "Singapore", tenureYears: 4.6, priorRating2024: "ACHIEVER", priorRating2025: "ACHIEVER", codeContributions: 295, aiUsagePercent: 73 },
  { email: "neha.bhatt@acme.com", name: "Neha Bhatt", title: "Software Engineer II", grade: "601", managerEmail: "priya.sundaram@acme.com",
    city: "Bangalore", country: "India", tenureYears: 2.8, priorRating2024: "ACHIEVER", priorRating2025: "ACHIEVER", codeContributions: 262, aiUsagePercent: 80 },
  { email: "chloe.bennett@acme.com", name: "Chloe Bennett", title: "Software Engineer I", grade: "502", managerEmail: "priya.sundaram@acme.com",
    city: "Sydney", country: "Australia", tenureYears: 1.1, priorRating2024: "ACHIEVER", priorRating2025: "ACHIEVER", codeContributions: 148, aiUsagePercent: 85 },
  { email: "manish.agarwal@acme.com", name: "Manish Agarwal", title: "Software Engineer II", grade: "601", managerEmail: "priya.sundaram@acme.com",
    city: "Pune", country: "India", tenureYears: 3.2, priorRating2024: "ACHIEVER", priorRating2025: "STAND_OUT", codeContributions: 290, aiUsagePercent: 89 },
  { email: "brandon.pierce@acme.com", name: "Brandon Pierce", title: "Software Engineer I", grade: "502", managerEmail: "priya.sundaram@acme.com",
    city: "Austin", country: "USA", tenureYears: 0.7, priorRating2024: "ACHIEVER", priorRating2025: "NEEDS_IMPROVEMENT", codeContributions: 45, aiUsagePercent: 38 },
  { email: "lakshmi.raghavan@acme.com", name: "Lakshmi Raghavan", title: "Senior Software Engineer", grade: "602", managerEmail: "priya.sundaram@acme.com",
    city: "Hyderabad", country: "India", tenureYears: 5.9, priorRating2024: "STAND_OUT", priorRating2025: "STAND_OUT", codeContributions: 412, aiUsagePercent: 94 },

  // Under Robert Marzetti
  { email: "arjun.malhotra@acme.com", name: "Arjun Malhotra", title: "Senior VP", grade: "603.2", managerEmail: "robert.marzetti@acme.com",
    city: "Bangalore", country: "India", tenureYears: 9.1, priorRating2024: "ACHIEVER", priorRating2025: "STAND_OUT" },

  // Arjun Malhotra's team
  { email: "austin.reed@acme.com", name: "Austin Reed", title: "Senior Software Engineer", grade: "602", managerEmail: "arjun.malhotra@acme.com",
    city: "San Francisco", country: "USA", tenureYears: 4.0, priorRating2024: "ACHIEVER", priorRating2025: "ACHIEVER", codeContributions: 318, aiUsagePercent: 75 },
  { email: "pooja.sharma@acme.com", name: "Pooja Sharma", title: "Software Engineer II", grade: "601", managerEmail: "arjun.malhotra@acme.com",
    city: "Mumbai", country: "India", tenureYears: 2.4, priorRating2024: "ACHIEVER", priorRating2025: "ACHIEVER", codeContributions: 244, aiUsagePercent: 68 },
  { email: "victoria.lane@acme.com", name: "Victoria Lane", title: "Software Engineer I", grade: "502", managerEmail: "arjun.malhotra@acme.com",
    city: "London", country: "UK", tenureYears: 1.0, priorRating2024: "ACHIEVER", priorRating2025: "ACHIEVER", codeContributions: 132, aiUsagePercent: 82 },
  { email: "rahul.chopra@acme.com", name: "Rahul Chopra", title: "Software Engineer II", grade: "601", managerEmail: "arjun.malhotra@acme.com",
    city: "Hyderabad", country: "India", tenureYears: 3.0, priorRating2024: "ACHIEVER", priorRating2025: "STAND_OUT", codeContributions: 305, aiUsagePercent: 87 },
  { email: "jordan.mills@acme.com", name: "Jordan Mills", title: "Software Engineer I", grade: "502", managerEmail: "arjun.malhotra@acme.com",
    city: "Toronto", country: "Canada", tenureYears: 0.6, priorRating2024: "ACHIEVER", priorRating2025: "ACHIEVER", codeContributions: 75, aiUsagePercent: 91 },
  { email: "deepak.nambiar@acme.com", name: "Deepak Nambiar", title: "Senior Software Engineer", grade: "602", managerEmail: "arjun.malhotra@acme.com",
    city: "Bangalore", country: "India", tenureYears: 6.2, priorRating2024: "STAND_OUT", priorRating2025: "ACHIEVER", codeContributions: 388, aiUsagePercent: 84 },

  // Under Rick Mojave
  { email: "marcus.whitfield@acme.com", name: "Marcus Whitfield", title: "VP", grade: "603.1", managerEmail: "rick.mojave@acme.com",
    city: "Toronto", country: "Canada", tenureYears: 6.5, priorRating2024: "ACHIEVER", priorRating2025: "ACHIEVER" },

  // Marcus Whitfield's team
  { email: "caleb.morrison@acme.com", name: "Caleb Morrison", title: "Senior Software Engineer", grade: "602", managerEmail: "marcus.whitfield@acme.com",
    city: "Toronto", country: "Canada", tenureYears: 4.7, priorRating2024: "ACHIEVER", priorRating2025: "ACHIEVER", codeContributions: 276, aiUsagePercent: 69 },
  { email: "shruti.joshi@acme.com", name: "Shruti Joshi", title: "Software Engineer II", grade: "601", managerEmail: "marcus.whitfield@acme.com",
    city: "Pune", country: "India", tenureYears: 2.7, priorRating2024: "ACHIEVER", priorRating2025: "STAND_OUT", codeContributions: 298, aiUsagePercent: 86 },
  { email: "natalie.spencer@acme.com", name: "Natalie Spencer", title: "Software Engineer I", grade: "502", managerEmail: "marcus.whitfield@acme.com",
    city: "Berlin", country: "Germany", tenureYears: 1.5, priorRating2024: "ACHIEVER", priorRating2025: "ACHIEVER", codeContributions: 158, aiUsagePercent: 77 },
  { email: "varun.reddy@acme.com", name: "Varun Reddy", title: "Software Engineer II", grade: "601", managerEmail: "marcus.whitfield@acme.com",
    city: "Hyderabad", country: "India", tenureYears: 3.3, priorRating2024: "NEEDS_IMPROVEMENT", priorRating2025: "ACHIEVER", codeContributions: 215, aiUsagePercent: 62 },
  { email: "dylan.carter@acme.com", name: "Dylan Carter", title: "Software Engineer I", grade: "502", managerEmail: "marcus.whitfield@acme.com",
    city: "Sydney", country: "Australia", tenureYears: 0.5, priorRating2024: "ACHIEVER", priorRating2025: "ACHIEVER", codeContributions: 58, aiUsagePercent: 95 },
  { email: "anjali.verma@acme.com", name: "Anjali Verma", title: "Senior Software Engineer", grade: "602", managerEmail: "marcus.whitfield@acme.com",
    city: "Mumbai", country: "India", tenureYears: 5.8, priorRating2024: "STAND_OUT", priorRating2025: "STAND_OUT", codeContributions: 402, aiUsagePercent: 91 },
  { email: "spencer.wallace@acme.com", name: "Spencer Wallace", title: "Software Engineer I", grade: "502", managerEmail: "marcus.whitfield@acme.com",
    city: "Austin", country: "USA", tenureYears: 0.4, priorRating2024: "ACHIEVER", priorRating2025: "ACHIEVER", codeContributions: 41, aiUsagePercent: 88 },

  // Under Jane Kruznetz
  { email: "rachel.donovan@acme.com", name: "Rachel Donovan", title: "VP", grade: "603.1", managerEmail: "jane.kruznetz@acme.com",
    city: "Berlin", country: "Germany", tenureYears: 5.5, priorRating2024: "ACHIEVER", priorRating2025: "STAND_OUT" },

  // Rachel Donovan's team
  { email: "logan.pierce@acme.com", name: "Logan Pierce", title: "Senior Software Engineer", grade: "602", managerEmail: "rachel.donovan@acme.com",
    city: "Berlin", country: "Germany", tenureYears: 4.5, priorRating2024: "ACHIEVER", priorRating2025: "ACHIEVER", codeContributions: 281, aiUsagePercent: 74 },
  { email: "kavya.nair@acme.com", name: "Kavya Nair", title: "Software Engineer II", grade: "601", managerEmail: "rachel.donovan@acme.com",
    city: "Bangalore", country: "India", tenureYears: 2.3, priorRating2024: "ACHIEVER", priorRating2025: "ACHIEVER", codeContributions: 252, aiUsagePercent: 81 },
  { email: "brooke.hamilton@acme.com", name: "Brooke Hamilton", title: "Software Engineer I", grade: "502", managerEmail: "rachel.donovan@acme.com",
    city: "London", country: "UK", tenureYears: 1.2, priorRating2024: "ACHIEVER", priorRating2025: "ACHIEVER", codeContributions: 168, aiUsagePercent: 83 },
  { email: "nikhil.saxena@acme.com", name: "Nikhil Saxena", title: "Software Engineer II", grade: "601", managerEmail: "rachel.donovan@acme.com",
    city: "Pune", country: "India", tenureYears: 3.5, priorRating2024: "ACHIEVER", priorRating2025: "STAND_OUT", codeContributions: 316, aiUsagePercent: 89 },
  { email: "trevor.quinn@acme.com", name: "Trevor Quinn", title: "Software Engineer II", grade: "601", managerEmail: "rachel.donovan@acme.com",
    city: "Dublin", country: "Ireland", tenureYears: 1.6, priorRating2024: "ACHIEVER", priorRating2025: "ACHIEVER", codeContributions: 218, aiUsagePercent: 89 },
  { email: "ishita.banerjee@acme.com", name: "Ishita Banerjee", title: "Senior Software Engineer", grade: "602", managerEmail: "rachel.donovan@acme.com",
    city: "Hyderabad", country: "India", tenureYears: 5.4, priorRating2024: "ACHIEVER", priorRating2025: "STAND_OUT", codeContributions: 367, aiUsagePercent: 85 },
  { email: "cameron.fox@acme.com", name: "Cameron Fox", title: "Software Engineer II", grade: "601", managerEmail: "rachel.donovan@acme.com",
    city: "Tokyo", country: "Japan", tenureYears: 1.4, priorRating2024: "ACHIEVER", priorRating2025: "ACHIEVER", codeContributions: 232, aiUsagePercent: 93 },
  { email: "aravind.krishnan@acme.com", name: "Aravind Krishnan", title: "Senior Software Engineer", grade: "602", managerEmail: "rachel.donovan@acme.com",
    city: "Mumbai", country: "India", tenureYears: 6.0, priorRating2024: "STAND_OUT", priorRating2025: "STAND_OUT", codeContributions: 421, aiUsagePercent: 92 },
];

function isSeniorLeader(grade: string): boolean {
  return grade.startsWith("604") || grade.startsWith("605");
}
function isManagerGrade(grade: string): boolean {
  return grade.startsWith("603");
}

function fillerJobFamily(grade: string): string {
  if (isSeniorLeader(grade)) return "Engineering Leadership";
  if (isManagerGrade(grade)) return "Engineering Management";
  return "Software Engineering";
}

function fillerCodeContributions(grade: string, override?: number): number {
  if (override != null) return override;
  if (isSeniorLeader(grade)) return 0;
  if (isManagerGrade(grade)) return 40 + Math.round((grade === "603.2" ? 30 : 60));
  return 200; // generic IC fallback (most are overridden above)
}

function fillerAiUsage(grade: string, override?: number): number {
  if (override != null) return override;
  if (isSeniorLeader(grade)) return 45;
  if (isManagerGrade(grade)) return 65;
  return 75;
}

// ─── Pass 1: upsert every user without managerId ─────────────────────────────

const emailToId = new Map<string, string>();
for (const row of ORG) {
  const data = {
    email: row.email,
    name: row.name,
    role:
      row.email === "john.doe@acme.com"
        ? "ADMIN"
        : isSeniorLeader(row.grade) || isManagerGrade(row.grade)
          ? "MANAGER"
          : "EMPLOYEE",
    title: row.title,
    grade: row.grade,
    gradeLevel: row.grade,
    jobFamily: row.jobFamily ?? fillerJobFamily(row.grade),
    jobFunction: "Technology",
    city: row.city ?? "Hyderabad",
    country: row.country ?? "India",
    tenureYears: row.tenureYears ?? 3.0,
    workingHours: 40,
    workStatus: "ACTIVE",
    priorRating2024: row.priorRating2024 ?? "ACHIEVER",
    priorRating2025: row.priorRating2025 ?? "ACHIEVER",
    codeContributions: fillerCodeContributions(row.grade, row.codeContributions),
    aiUsagePercent: fillerAiUsage(row.grade, row.aiUsagePercent),
  };
  const u = await db.user.upsert({
    where: { email: row.email },
    update: data,
    create: data,
  });
  emailToId.set(row.email, u.id);
}

// ─── Pass 2: set managerId now that everyone exists ──────────────────────────

for (const row of ORG) {
  const managerId = row.managerEmail
    ? (emailToId.get(row.managerEmail) ?? null)
    : null;
  await db.user.update({
    where: { email: row.email },
    data: { managerId },
  });
}

// ─── Template + Review periods (owned by the MD) ─────────────────────────────

const md = await db.user.findUniqueOrThrow({ where: { email: "john.doe@acme.com" } });

const template = await db.template.upsert({
  where: { id: "tmpl-default" },
  update: {},
  create: {
    id: "tmpl-default",
    name: "Standard 2026",
    creatorId: md.id,
    questions: {
      create: [
        { prompt: "What were your biggest contributions this period?", kind: "TEXT", order: 1 },
        { prompt: "Where did you grow most?", kind: "TEXT", order: 2 },
        { prompt: "Overall performance rating", kind: "RATING", order: 3 },
      ],
    },
  },
});

const periods = [
  {
    id: "rp-h1-2026",
    name: "H1 2026 Performance Review",
    startsAt: new Date("2026-06-01"),
    endsAt: new Date("2026-06-30"),
    status: "DRAFT",
    cadence: "SEMIANNUAL",
  },
  {
    id: "rp-q4-eng",
    name: "Q4 Engineering Review",
    startsAt: new Date("2026-04-01"),
    endsAt: new Date("2026-05-15"),
    status: "OPEN",
    cadence: "QUARTERLY",
  },
  {
    id: "rp-yearend-2025",
    name: "Year-end 2025",
    startsAt: new Date("2025-12-01"),
    endsAt: new Date("2026-01-31"),
    status: "CLOSED",
    cadence: "ANNUAL",
  },
];

for (const p of periods) {
  await db.reviewPeriod.upsert({
    where: { id: p.id },
    update: { cadence: p.cadence },
    create: { ...p, ownerId: md.id, templateId: template.id },
  });
}

const openPeriodId = "rp-q4-eng";

// ─── MANAGER reviews: one per user with a manager ────────────────────────────
// Every reviewer's inbox is populated. Most start blank — they can be filled
// in via the UI. Marcus Bennett's gets rich evidence so the demo is loaded.

for (const row of ORG) {
  if (!row.managerEmail) continue;
  const subjectId = emailToId.get(row.email)!;
  const reviewerId = emailToId.get(row.managerEmail)!;

  await db.review.upsert({
    where: {
      reviewPeriodId_subjectId_reviewerId_kind: {
        reviewPeriodId: openPeriodId,
        subjectId,
        reviewerId,
        kind: "MANAGER",
      },
    },
    update: {},
    create: {
      reviewPeriodId: openPeriodId,
      subjectId,
      reviewerId,
      kind: "MANAGER",
      status: "DRAFT",
    },
  });
}

// ─── Rich evidence on Marcus Bennett's review (by Laura Sanchez) ─────────────

const marcus = await db.user.findUniqueOrThrow({ where: { email: "marcus.bennett@acme.com" } });
const laura = await db.user.findUniqueOrThrow({ where: { email: "laura.sanchez@acme.com" } });
const marcusReview = await db.review.findFirstOrThrow({
  where: {
    reviewPeriodId: openPeriodId,
    subjectId: marcus.id,
    reviewerId: laura.id,
    kind: "MANAGER",
  },
});

await db.evidenceEntry.deleteMany({ where: { reviewId: marcusReview.id } });

const MARCUS_WHAT: { body: string; createdAt: Date; type?: "POSITIVE" | "CONCERN" }[] = [
  {
    createdAt: new Date("2026-02-07"),
    body: "Delivered the MRPS rule-interface refactor on schedule, replacing the legacy gating layer. UAT defect rate dropped ~40% after he introduced contract tests across the CD corrections flow.",
  },
  {
    createdAt: new Date("2026-01-22"),
    type: "CONCERN",
    body: "Missed the dependency upgrade window in week 3 — caused a 36-hour delay for the platform team's release. Recovered well after, but the impact was avoidable; he pushed it to the last day and the surprise cascaded.",
  },
  {
    createdAt: new Date("2026-01-02"),
    body: "Kicked off ownership of the Composable Design system modernization. Scoped the migration, identified the three highest-risk integrations, and shipped the first end-to-end smoke pipeline within the first two weeks.",
  },
];

const MARCUS_HOW: { body: string; createdAt: Date; type?: "POSITIVE" | "CONCERN" }[] = [
  {
    createdAt: new Date("2026-02-12"),
    body: "Do the right thing: pushed back on a proposed shortcut around audit logging. Raised it cleanly with product before escalating; we ended up keeping the controls and shipping on time.",
  },
  {
    createdAt: new Date("2026-01-15"),
    body: "Earn trust: held weekly demo sessions for stakeholders during the migration. No surprises at go-live. Improve relentlessly: ran a retro after each release and folded findings back into the test harness.",
  },
];

for (const e of MARCUS_WHAT) {
  await db.evidenceEntry.create({
    data: {
      reviewId: marcusReview.id,
      dimension: "WHAT",
      type: e.type ?? "POSITIVE",
      body: e.body,
      createdAt: e.createdAt,
      authorId: laura.id,
    },
  });
}
for (const e of MARCUS_HOW) {
  await db.evidenceEntry.create({
    data: {
      reviewId: marcusReview.id,
      dimension: "HOW",
      type: e.type ?? "POSITIVE",
      body: e.body,
      createdAt: e.createdAt,
      authorId: laura.id,
    },
  });
}

// ─── Two technical-track ICs reporting to EDs: ratings + evidence ────────────
// These demonstrate that 603.x can be ICs (Principal Engineer / Tech Lead) and
// not just managers. Their reviews are loaded with realistic evidence and
// committed ratings; their calibration is pre-baked into the audit log.

type EvidenceRow = { body: string; createdAt: Date; type?: "POSITIVE" | "CONCERN" };

interface IcSeed {
  email: string;
  managerEmail: string;
  whatRating: Rating;
  howRating: Rating;
  what: EvidenceRow[];
  how: EvidenceRow[];
  growth?: EvidenceRow[];
  /** Quintile rationale once the manager calibrated them. The seed bumps
   *  existing assignments in the same grade down by 1 and places this IC at
   *  rank #1 so the rationale renders against a real top-of-grade move. */
  calibrationRationale: string;
}

const TECHNICAL_TRACK_ICS: IcSeed[] = [
  {
    email: "aaron.yamamoto@acme.com",
    managerEmail: "rue.oberi@acme.com",
    whatRating: "STAND_OUT",
    howRating: "STAND_OUT",
    what: [
      {
        createdAt: new Date("2026-04-22"),
        body: "Led the multi-region failover redesign for the orchestration platform. Cut planned-maintenance customer impact from 14 min to under 90 sec on the last two scheduled windows. Wrote the design doc that became the reference architecture for the org.",
      },
      {
        createdAt: new Date("2026-03-10"),
        body: "Mentored two senior engineers (Marcus Bennett, Karthik Subramanian) through their first cross-org RFCs. Both shipped within the quarter. He didn't write the code — he raised the ceiling.",
      },
      {
        createdAt: new Date("2026-02-04"),
        body: "Identified a class of subtle race conditions in the streaming dedup layer that had been quietly causing 0.3% duplicate events. Root-caused, fixed, and back-patched two releases. Wrote up the failure mode publicly so other teams can detect similar patterns.",
      },
    ],
    how: [
      {
        createdAt: new Date("2026-04-12"),
        body: "Do the right thing: blocked a launch that would have shipped without the rollback plan he'd flagged in design review. Held the line politely but firmly; the team thanked him in retro after the change was caught by the new safeguards in week 1.",
      },
      {
        createdAt: new Date("2026-02-25"),
        body: "Earn trust: hosted weekly office hours for the platform team during the failover migration. Improve relentlessly: started a 'kill it if it's not paying rent' review of legacy services — three retired so far, two more in progress.",
      },
    ],
    growth: [
      {
        createdAt: new Date("2026-04-30"),
        body: "Stretch goal: spend more time on the executive narrative — the work is exceptional but stakeholders three levels up aren't seeing it. Picking one quarterly story per period and presenting it at the leadership forum would close that gap.",
      },
    ],
    calibrationRationale:
      "Aaron is the clear top of 603.2 this period. The failover redesign alone is a stand-out outcome at architect scope, and the mentorship lift on Marcus and Karthik multiplies his impact beyond his own code. Holding firm on the launch gate (HOW) is exactly the bar at this grade. Placing at #1.",
  },
  {
    email: "sophia.lindberg@acme.com",
    managerEmail: "jessica.morales@acme.com",
    whatRating: "STAND_OUT",
    howRating: "ACHIEVER",
    what: [
      {
        createdAt: new Date("2026-04-28"),
        body: "Drove the migration of the customer-search service to the new vector index. Search latency P95 dropped from 480ms to 95ms; relevance NDCG up 17%. Coordinated four teams without dropping a single release in the quarter.",
      },
      {
        createdAt: new Date("2026-03-15"),
        body: "Owned the data-quality remediation after the schema drift incident in February. Wrote the contract-test framework that caught two more drift cases before they shipped. Tooling adopted by the platform team.",
      },
      {
        createdAt: new Date("2026-02-20"),
        body: "Tech-lead for the streaming pipeline team. Their on-time delivery rate went from 62% (H2 2025) to 91% (this quarter). She didn't push harder — she shortened the feedback loop on what 'done' means.",
      },
    ],
    how: [
      {
        createdAt: new Date("2026-04-05"),
        body: "Improve relentlessly: ran a blameless retro after the schema drift incident, surfaced two systemic issues, and got both prioritized into the next sprint. The team has visibly more trust in the post-mortem process now.",
      },
      {
        createdAt: new Date("2026-03-02"),
        type: "CONCERN",
        body: "Earn trust: late communication on the vector-index migration timeline slipped — partners learned about the new schedule from a calendar invite, not a heads-up. Recovered fast and owned it publicly, but the pattern is worth watching.",
      },
    ],
    growth: [
      {
        createdAt: new Date("2026-05-02"),
        body: "Next investment: tighten the cadence on stakeholder updates BEFORE plans shift, not after. The technical work is stand-out; the communication consistency is the thing keeping HOW at Achiever rather than the same bar.",
      },
    ],
    calibrationRationale:
      "Sophia delivered an outstanding period on outcomes — the search migration and the on-time-delivery turnaround are both top-quartile results. HOW is held at Achiever because of the communication-cadence pattern around the migration; she owned it cleanly, but it's a real signal. Placing at #1 of 603.1 — outcomes are the load-bearing axis at this grade and hers are unambiguous.",
  },
];

for (const ic of TECHNICAL_TRACK_ICS) {
  const subject = await db.user.findUniqueOrThrow({ where: { email: ic.email } });
  const reviewer = await db.user.findUniqueOrThrow({ where: { email: ic.managerEmail } });
  const review = await db.review.findFirstOrThrow({
    where: {
      reviewPeriodId: openPeriodId,
      subjectId: subject.id,
      reviewerId: reviewer.id,
      kind: "MANAGER",
    },
  });

  // Commit ratings (manager has decided).
  await db.review.update({
    where: { id: review.id },
    data: {
      whatRating: ic.whatRating,
      howRating: ic.howRating,
      status: "SUBMITTED",
      submittedAt: new Date("2026-05-05"),
    },
  });

  // Replace evidence so re-runs stay clean.
  await db.evidenceEntry.deleteMany({ where: { reviewId: review.id } });
  for (const e of ic.what) {
    await db.evidenceEntry.create({
      data: {
        reviewId: review.id,
        dimension: "WHAT",
        type: e.type ?? "POSITIVE",
        body: e.body,
        createdAt: e.createdAt,
        authorId: reviewer.id,
      },
    });
  }
  for (const e of ic.how) {
    await db.evidenceEntry.create({
      data: {
        reviewId: review.id,
        dimension: "HOW",
        type: e.type ?? "POSITIVE",
        body: e.body,
        createdAt: e.createdAt,
        authorId: reviewer.id,
      },
    });
  }
  for (const e of ic.growth ?? []) {
    await db.evidenceEntry.create({
      data: {
        reviewId: review.id,
        dimension: "GROWTH",
        type: e.type ?? "POSITIVE",
        body: e.body,
        createdAt: e.createdAt,
        authorId: reviewer.id,
      },
    });
  }

  // Calibration: place at top of their grade. Bump existing assignments in
  // the same grade down by 1 first to keep ranks dense. Log a HUMAN-source
  // move so it appears in the audit log as a calibrated decision.
  await db.$transaction(async (tx) => {
      const sameGradeAssignments = await tx.quintileAssignment.findMany({
        where: {
          reviewPeriodId: openPeriodId,
          subject: { grade: subject.grade },
          NOT: { subjectId: subject.id },
        },
        orderBy: { rankInGrade: "asc" },
      });

      // Two-phase bump (negative ranks first) to avoid any future unique constraint surprises.
      if (sameGradeAssignments.length > 0) {
        await tx.quintileAssignment.updateMany({
          where: { id: { in: sameGradeAssignments.map((a) => a.id) } },
          data: { rankInGrade: -1 },
        });
        for (let i = 0; i < sameGradeAssignments.length; i++) {
          await tx.quintileAssignment.update({
            where: { id: sameGradeAssignments[i].id },
            data: { rankInGrade: i + 2 },
          });
        }
      }

      const existing = await tx.quintileAssignment.findUnique({
        where: {
          reviewPeriodId_subjectId: {
            reviewPeriodId: openPeriodId,
            subjectId: subject.id,
          },
        },
      });
      const fromRank = existing?.rankInGrade ?? null;

      await tx.quintileAssignment.upsert({
        where: {
          reviewPeriodId_subjectId: {
            reviewPeriodId: openPeriodId,
            subjectId: subject.id,
          },
        },
        update: {
          rankInGrade: 1,
          rationale: ic.calibrationRationale,
          source: "HUMAN",
        },
        create: {
          reviewPeriodId: openPeriodId,
          subjectId: subject.id,
          rankInGrade: 1,
          rationale: ic.calibrationRationale,
          source: "HUMAN",
        },
      });

      const totalInGrade = sameGradeAssignments.length + 1;
      await tx.quintileMove.create({
        data: {
          reviewPeriodId: openPeriodId,
          subjectId: subject.id,
          fromRank,
          toRank: 1,
          // Quintile 1 — top 10%.
          fromQuintile: fromRank != null ? Math.min(5, Math.ceil(fromRank / Math.max(1, totalInGrade) * 5)) : null,
          toQuintile: 1,
          rationale: ic.calibrationRationale,
          source: "HUMAN",
          movedById: reviewer.id,
          createdAt: new Date("2026-05-06"),
        },
      });
    });
}

// ─── Ratings + calibration cleanup for the 9 ex-501 people ───────────────────
// Grade 501 has been retired — the 9 former Junior SEs are now 502 (Software
// Engineer I) or 601 (Software Engineer II). Set realistic MANAGER review
// ratings and drop any stale QuintileAssignment/QuintileMove rows so the
// calibration page re-derives their placement in their new grade context.

interface RatedIc {
  email: string;
  whatRating: Rating;
  howRating: Rating;
}

const REGRADED_ICS: RatedIc[] = [
  // 502 cohort
  { email: "olivia.reyes@acme.com", whatRating: "ACHIEVER", howRating: "ACHIEVER" },
  { email: "grace.sullivan@acme.com", whatRating: "ACHIEVER", howRating: "ACHIEVER" },
  // Lauren — strongest output in the 502 cohort.
  { email: "lauren.mitchell@acme.com", whatRating: "STAND_OUT", howRating: "ACHIEVER" },
  // Brandon — prior 2025 was already NEEDS_IMPROVEMENT, low AI usage, low contribs.
  { email: "brandon.pierce@acme.com", whatRating: "NEEDS_IMPROVEMENT", howRating: "NEEDS_IMPROVEMENT" },
  { email: "jordan.mills@acme.com", whatRating: "ACHIEVER", howRating: "ACHIEVER" },
  { email: "dylan.carter@acme.com", whatRating: "ACHIEVER", howRating: "ACHIEVER" },
  { email: "spencer.wallace@acme.com", whatRating: "ACHIEVER", howRating: "ACHIEVER" },
  // 601 promotions
  { email: "trevor.quinn@acme.com", whatRating: "ACHIEVER", howRating: "STAND_OUT" },
  { email: "cameron.fox@acme.com", whatRating: "STAND_OUT", howRating: "STAND_OUT" },
];

for (const ic of REGRADED_ICS) {
  const subject = await db.user.findUnique({ where: { email: ic.email } });
  if (!subject) continue;

  // Find the MANAGER review for the open period.
  const review = await db.review.findFirst({
    where: {
      reviewPeriodId: openPeriodId,
      subjectId: subject.id,
      kind: "MANAGER",
    },
  });
  if (review) {
    await db.review.update({
      where: { id: review.id },
      data: {
        whatRating: ic.whatRating,
        howRating: ic.howRating,
      },
    });
  }

  // Drop stale calibration state — these people changed grade, so their old
  // rankInGrade is meaningless. Page-load will re-derive them at the bottom
  // of their new grade via ensureInitialAssignments.
  await db.quintileMove.deleteMany({
    where: { reviewPeriodId: openPeriodId, subjectId: subject.id },
  });
  await db.quintileAssignment.deleteMany({
    where: { reviewPeriodId: openPeriodId, subjectId: subject.id },
  });
}

console.log("Seeded:", {
  users: await db.user.count(),
  templates: await db.template.count(),
  questions: await db.question.count(),
  reviewPeriods: await db.reviewPeriod.count(),
  reviews: await db.review.count(),
  evidenceEntries: await db.evidenceEntry.count(),
  quintileAssignments: await db.quintileAssignment.count(),
  quintileMoves: await db.quintileMove.count(),
});

await db.$disconnect();
