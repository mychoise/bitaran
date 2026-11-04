import type { ExpenseType, PhotoFlag, StaffRole } from "@/lib/api/types";
export const ROLE_LABEL: Record<StaffRole, string> = { owner: "Owner", manager: "Manager", salesman: "Salesman" };


/** Why a visit photo was flagged, in plain words. Flags ask for a look; they are not faults. */
export const PHOTO_FLAG: Record<PhotoFlag, { short: string; line: string }> = {
  old_photo: { short: "Old photo", line: "The camera's time is well before it was sent." },
  far_from_shop: { short: "Too far from the shop", line: "Taken away from the shop's saved location." },
  duplicate: { short: "Same as an earlier photo", line: "It looks the same as an earlier photo." },
  no_photo_data: { short: "No photo data", line: "The picture came without the camera's own time." },
};

export const EXPENSE_TYPE: Record<ExpenseType, string> = { salary: "Salary", fuel: "Fuel", khaja: "Khaja", misc: "Miscellaneous" };
