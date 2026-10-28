import maizeSacks from "../../../public/photos/maize-sacks.jpg";
import { CashCheck } from "@/components/product/CashCheck";
import { CreditLedger } from "@/components/product/CreditLedger";
import { DailyPlanSheet } from "@/components/product/DailyPlanSheet";
import { ExpenseSheet } from "@/components/product/ExpenseSheet";
import { Invoice } from "@/components/product/Invoice";
import { InvoiceRegister } from "@/components/product/InvoiceRegister";
import { PaymentsQueue } from "@/components/product/PaymentsQueue";
import { ReconcileSheet } from "@/components/product/ReconcileSheet";
import { ReportsBoard } from "@/components/product/ReportsBoard";
import { ReturnsSheet } from "@/components/product/ReturnsSheet";
import { RolesMatrix } from "@/components/product/RolesMatrix";
import { ShopStatementScreen } from "@/components/product/ShopStatementScreen";
import { ShopVisitScreen } from "@/components/product/ShopVisitScreen";
import { VisitReview } from "@/components/product/VisitReview";
import type { Group } from "./FeatureGroup";

// Section ids match the footer's links (#routes, #credit, #payments, #reconcile, #reports).
export const groups: Group[] = [
  {
    id: "field",
    name: "Field sales",
    line: "What happens on the route.",
    features: [
      {
        id: "routes",
        short: "Routes and daily plans",
        title: "A route and a load for every salesman",
        body: "The manager gives each salesman a route for the day, such as Bagar to Lamachaur, and the stock to carry. Shops come up in visiting order.",
        who: "The manager sets it. The salesman follows it.",
        saves: "Morning calls about who goes where with what.",
        layout: "text-left",
        screenshot: "Manager's daily plan: salesman, route, shops in order, stock issued",
        visual: <DailyPlanSheet />,
      },
      {
        id: "phone",
        short: "Salesman's phone screen",
        title: "The shop's history, at the counter",
        body: "At each shop the salesman sees what it bought before, what it still owes and what it has bought today. He records the sale there and then.",
        who: "Salesman.",
        saves: "Notebooks copied up at night, and sales nobody wrote down.",
        layout: "visual-left",
        screenshot: "Salesman's phone screen at one shop: balance, history, today's sale",
        visual: <ShopVisitScreen />,
      },
      {
        id: "visits",
        short: "Visit photo proof",
        title: "Proof that the visit happened",
        body: "Each visit photo is stamped with the date and time and checked against the shop's location. Old or reused photos are flagged. The same photo can never be uploaded twice.",
        who: "The salesman takes it. The manager reviews the flags.",
        saves: "Guessing whether a shop was really visited.",
        layout: "stacked",
        screenshot: "Manager's review of visit photos with location checks and flags",
        visual: <VisitReview />,
      },
    ],
  },
  {
    id: "money",
    name: "Money",
    line: "Every sale numbered, every rupee of udharo tracked, every payment with its proof.",
    features: [
      {
        id: "invoices",
        short: "Invoices",
        title: "Invoice numbers with no gaps",
        body: "Every sale gets the next invoice number. A cancelled sale keeps its number and is marked cancelled, so there are no unexplained gaps.",
        who: "Salesman and manager.",
        saves: "Hunting for missing bill numbers.",
        layout: "text-left",
        screenshot: "An invoice and the invoice list with one cancelled number",
        visual: (
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <Invoice className="shrink-0" />
            <InvoiceRegister />
          </div>
        ),
      },
      {
        id: "credit",
        short: "Udharo and balances",
        title: "Udharo with a limit",
        body: "Each shop has a credit limit, a running balance and due dates. Overdue shops are listed first. A sale over the limit is blocked unless a manager allows it. Old balances can be loaded in.",
        who: "Manager and owner.",
        saves: "Credit that grows past what a shop can pay.",
        layout: "stacked",
        screenshot: "Udharo list by shop with an over-limit sale blocked",
        visual: <CreditLedger />,
      },
      {
        id: "payments",
        short: "Payments with proof",
        title: "Payments with proof attached",
        body: "Cash, cheque or online. Cheques need a photo, online payments a screenshot that cannot be reused. Both stay pending until a manager confirms, and a bounced cheque never reduces what the shop owes.",
        who: "The salesman collects. The manager confirms.",
        saves: "Arguments over which cheque cleared and what was really paid.",
        layout: "visual-left",
        screenshot: "Payments list: cash, pending cheque, confirmed and rejected online payments, bounced cheque",
        visual: <PaymentsQueue />,
      },
      {
        id: "expenses",
        short: "Expenses",
        title: "Salary, fuel and khaja, by person and day",
        body: "Expenses are recorded against a person and a day, with an optional photo of the bill. Salesmen enter their own fuel and khaja.",
        who: "Manager and owner. Salesmen, for their own fuel and khaja.",
        saves: "Loose receipts and guesswork at the end of the month.",
        layout: "text-left",
        screenshot: "One day's expenses by person and type",
        visual: <ExpenseSheet />,
      },
    ],
  },
  {
    id: "stock",
    name: "Stock",
    line: "What went out, what came back, and what is missing.",
    photo: {
      src: maizeSacks,
      alt: "Sacks of grain stacked high in a store",
      slotAlt: "Your own store or warehouse: stacked sacks, cartons or the morning load",
    },
    features: [
      {
        id: "reconcile",
        short: "Stock out and reconcile",
        title: "Count the stock, then the cash",
        body: "Stock goes out in the morning. At night the salesman reports what is unsold, the manager counts it and any shortage shows. Cash handed over is checked against cash collected.",
        who: "Manager and salesman. The manager's count always wins.",
        saves: "Missing stock found weeks later, with no one to ask.",
        layout: "stacked",
        screenshot: "End-of-day reconcile with shortage, and the cash check",
        visual: (
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
            <ReconcileSheet />
            <CashCheck className="shrink-0" />
          </div>
        ),
      },
      {
        id: "returns",
        short: "Damaged and expired goods",
        title: "Damaged and expired goods, kept apart",
        body: "Returned goods are credited to the shop with a reason: damaged, expired or other. They never go back into sellable stock. Your own damaged or expired stock can be written off with a reason.",
        who: "Manager and salesman.",
        saves: "Bad goods sold again by mistake, and write-offs nobody can explain.",
        layout: "visual-left",
        screenshot: "Returns and write-offs with reasons and credits",
        visual: <ReturnsSheet />,
      },
    ],
  },
  {
    id: "control",
    name: "Control",
    line: "The numbers, and who is allowed to see them.",
    features: [
      {
        id: "reports",
        short: "Reports",
        title: "Today's numbers, and every day before",
        body: "Today's sales across all shops, each salesman's full history, sales per day and per shop, top products, overdue credit and low stock.",
        who: "Owner and manager. A salesman sees only his own.",
        saves: "Adding up notebooks to find out how the day went.",
        layout: "stacked",
        screenshot: "Owner's reports: sales by salesman, overdue, top products, low stock",
        visual: <ReportsBoard />,
      },
      {
        id: "roles",
        short: "Roles and access",
        title: "Everyone sees only their part",
        body: "One owner per business, and any number of managers and salesmen, each with their own login. A salesman sees only his own work, and cost prices are hidden from salesmen.",
        who: "Owner.",
        saves: "One shared password, and your margins on every salesman's phone.",
        layout: "text-left",
        screenshot: "Roles and what each one can see",
        visual: <RolesMatrix />,
      },
      {
        id: "shop-login",
        short: "Shop login",
        title: "Shops can check their own balance",
        body: "A shop can log in to see its own balance and statement, and nothing else.",
        who: "Shop.",
        saves: "Calls asking how much is still owed.",
        layout: "visual-left",
        screenshot: "A shop's own account on a phone: balance and statement",
        visual: <ShopStatementScreen className="mx-auto lg:mx-0 lg:ml-auto" />,
      },
    ],
  },
];
