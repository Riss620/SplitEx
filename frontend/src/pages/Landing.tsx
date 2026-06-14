import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { 
  ArrowRight, 
  Calculator, 
  Users, 
  Coins, 
  FileSpreadsheet, 
  ShieldCheck, 
  LineChart 
} from 'lucide-react';

export const Landing: React.FC = () => {
  const { user } = useAuth();

  // Interactive Solver State
  const [roommateAPaid, setRoommateAPaid] = React.useState<number>(1800);
  const [roommateBPaid, setRoommateBPaid] = React.useState<number>(0);
  const [roommateCPaid, setRoommateCPaid] = React.useState<number>(0);
  const [solverResults, setSolverResults] = React.useState<{ from: string; to: string; amount: number }[]>([]);

  const totalExpense = roommateAPaid + roommateBPaid + roommateCPaid;
  // Each member's equal share of the total group expense (divided among ALL 3)
  const share = Number((totalExpense / 3).toFixed(2));

  // Net = amount_paid - equal_share_owed
  // Positive net → group owes them | Negative net → they owe the group
  const roommateANet = Number((roommateAPaid - share).toFixed(2));
  const roommateBNet = Number((roommateBPaid - share).toFixed(2));
  const roommateCNet = Number((roommateCPaid - share).toFixed(2));

  // Represents sum of all net balances (should be ~0 if share is computed correctly)
  const sumOfBalances = Number((roommateANet + roommateBNet + roommateCNet).toFixed(2));

  React.useEffect(() => {
    const people = [
      { name: 'Roommate A', net: roommateANet },
      { name: 'Roommate B', net: roommateBNet },
      { name: 'Roommate C', net: roommateCNet },
    ];
    
    const debtors = people.filter(p => p.net < 0).map(p => ({ ...p })).sort((a, b) => a.net - b.net);
    const creditors = people.filter(p => p.net > 0).map(p => ({ ...p })).sort((a, b) => b.net - a.net);

    const transfers: { from: string; to: string; amount: number }[] = [];
    let dIdx = 0;
    let cIdx = 0;

    while (dIdx < debtors.length && cIdx < creditors.length) {
      const debtor = debtors[dIdx];
      const creditor = creditors[cIdx];

      const debtAmount = Math.abs(debtor.net);
      const creditAmount = creditor.net;

      const transferAmount = Math.min(debtAmount, creditAmount);

      if (transferAmount > 0.01) {
        transfers.push({
          from: debtor.name,
          to: creditor.name,
          amount: Number(transferAmount.toFixed(2))
        });
      }

      debtor.net += transferAmount;
      creditor.net -= transferAmount;

      if (Math.abs(debtor.net) < 0.01) dIdx++;
      if (creditor.net < 0.01) cIdx++;
    }

    setSolverResults(transfers);
  }, [roommateANet, roommateBNet, roommateCNet]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary selection:text-primary-foreground overflow-x-hidden">
      {/* Interactive Top Navbar */}
      <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur-md transition-all">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-9 w-9 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center font-extrabold text-primary text-lg">
              S
            </span>
            <span className="font-extrabold text-xl text-gradient tracking-tight">SplitEx</span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#tech-stack" className="hover:text-foreground transition-colors">Architecture</a>
            <a href="#settlement-solver" className="hover:text-foreground transition-colors">Solver</a>
          </nav>

          <div className="flex items-center gap-3">
            {user ? (
              <Link
                to="/dashboard"
                className="bg-primary text-primary-foreground font-semibold px-4 py-2 rounded-xl text-sm hover:opacity-95 shadow-lg shadow-primary/10 transition-all flex items-center gap-1.5"
              >
                Go to Dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="hover:text-foreground text-sm font-medium text-muted-foreground transition-colors px-3 py-1.5"
                >
                  Log In
                </Link>
                <Link
                  to="/register"
                  className="bg-primary text-primary-foreground font-semibold px-4 py-2 rounded-xl text-sm hover:opacity-95 shadow-lg shadow-primary/10 transition-all"
                >
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-24 md:py-32 flex items-center justify-center overflow-hidden">
        {/* Decorative background gradients */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none -z-10"></div>
        <div className="absolute top-1/3 left-1/3 w-[300px] h-[300px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none -z-10"></div>

        <div className="max-w-4xl mx-auto px-6 text-center space-y-6">
          <div className="inline-flex items-center gap-1.5 bg-secondary/80 border border-border px-3.5 py-1 rounded-full text-xs font-semibold text-primary/90">
            <ShieldCheck className="h-3.5 w-3.5" />
            Algorithm-Driven Shared Expense Engine
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.1] text-foreground">
            Shared Expense Management, <br />
            <span className="text-gradient">Solved Algorithmically.</span>
          </h1>

          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            SplitEx is a production-ready billing ledger for flatmates featuring timeline-aware memberships, multi-currency conversions, greedy transaction solvers, and automatic duplicate reviews.
          </p>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
            {user ? (
              <Link
                to="/dashboard"
                className="w-full sm:w-auto bg-primary text-primary-foreground font-bold px-8 py-3.5 rounded-xl text-sm hover:opacity-95 shadow-lg shadow-primary/15 transition-all flex items-center justify-center gap-2"
              >
                Go to Dashboard
                <ArrowRight className="h-4.5 w-4.5" />
              </Link>
            ) : (
              <>
                <Link
                  to="/register"
                  className="w-full sm:w-auto bg-primary text-primary-foreground font-bold px-8 py-3.5 rounded-xl text-sm hover:opacity-95 shadow-lg shadow-primary/15 transition-all flex items-center justify-center gap-2"
                >
                  Get Started
                  <ArrowRight className="h-4.5 w-4.5" />
                </Link>
                <Link
                  to="/login"
                  className="w-full sm:w-auto bg-secondary hover:bg-secondary/80 border border-border text-foreground font-semibold px-8 py-3.5 rounded-xl text-sm transition-all"
                >
                  Sign In to SplitEx
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Core Features Grid */}
      <section id="features" className="py-20 bg-secondary/10 border-y border-border/30 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center space-y-3 mb-16">
            <h2 className="text-3xl font-bold tracking-tight">Technical Highlights</h2>
            <p className="text-muted-foreground text-sm max-w-lg mx-auto">
              Engineered with advanced algorithms and strict relational validation rules.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-card border border-border/80 p-6 rounded-2xl glass-panel space-y-4 hover:border-primary/30 transition-all group">
              <div className="p-3 bg-primary/10 rounded-xl text-primary w-fit group-hover:scale-110 transition-transform">
                <Calculator className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold">Greedy Settlement Solver</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Aggregates net balances and applies a greedy matching heuristic to pair maximum creditors with maximum debtors, minimizing absolute transaction paths.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-card border border-border/80 p-6 rounded-2xl glass-panel space-y-4 hover:border-primary/30 transition-all group">
              <div className="p-3 bg-primary/10 rounded-xl text-primary w-fit group-hover:scale-110 transition-transform">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold">Temporal Membership Log</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Tracks join and leave dates of flatmates. Splits are dynamically adjusted chronologically to prevent members from being charged for periods they weren't active.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-card border border-border/80 p-6 rounded-2xl glass-panel space-y-4 hover:border-primary/30 transition-all group">
              <div className="p-3 bg-primary/10 rounded-xl text-primary w-fit group-hover:scale-110 transition-transform">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold">CSV Anomaly Engine</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Evaluates bulk CSV uploads against 15 strict logical checks (such as duplicates in 24 hrs, currency anomalies) before committing entries.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Solver Demo Section */}
      <section id="settlement-solver" className="py-20 bg-card border-b border-border/30 relative">
        <div className="absolute inset-0 bg-primary/[0.01] pointer-events-none"></div>
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center space-y-3 mb-12">
            <h2 className="text-3xl font-bold tracking-tight">Interactive Settlement Solver</h2>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Modify roommate balances below to see the Greedy Solver calculate the optimized settlement path in real time.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-background/50 border border-border p-6 sm:p-8 rounded-2xl glass-panel">
            {/* Input Ledger controls */}
            <div className="space-y-5">
              <h3 className="text-base font-bold flex items-center gap-2 border-b border-border pb-3">
                <span className="h-6 w-6 bg-primary/10 rounded flex items-center justify-center text-xs font-bold text-primary">1</span>
                <span>Roommate Expenses Paid</span>
              </h3>

              <div className="space-y-4">
                {/* Roommate A */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-foreground">Roommate A (Paid)</span>
                    <span className="text-primary">₹{roommateAPaid}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="3000"
                    step="50"
                    value={roommateAPaid}
                    onChange={(e) => setRoommateAPaid(Number(e.target.value))}
                    className="w-full accent-primary h-1 bg-secondary rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>Share: ₹{share}</span>
                    <span className={roommateANet >= 0 ? 'text-primary' : 'text-destructive'}>
                      Net: {roommateANet >= 0 ? '+' : ''}₹{roommateANet}
                    </span>
                  </div>
                </div>

                {/* Roommate B */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-foreground">Roommate B (Paid)</span>
                    <span className="text-primary">₹{roommateBPaid}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="3000"
                    step="50"
                    value={roommateBPaid}
                    onChange={(e) => setRoommateBPaid(Number(e.target.value))}
                    className="w-full accent-primary h-1 bg-secondary rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>Share: ₹{share}</span>
                    <span className={roommateBNet >= 0 ? 'text-primary' : 'text-destructive'}>
                      Net: {roommateBNet >= 0 ? '+' : ''}₹{roommateBNet}
                    </span>
                  </div>
                </div>

                {/* Roommate C */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-foreground">Roommate C (Paid)</span>
                    <span className="text-primary">₹{roommateCPaid}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="3000"
                    step="50"
                    value={roommateCPaid}
                    onChange={(e) => setRoommateCPaid(Number(e.target.value))}
                    className="w-full accent-primary h-1 bg-secondary rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>Share: ₹{share}</span>
                    <span className={roommateCNet >= 0 ? 'text-primary' : 'text-destructive'}>
                      Net: {roommateCNet >= 0 ? '+' : ''}₹{roommateCNet}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Message */}
              <div className="pt-2">
                <div className="p-3 bg-primary/10 border border-primary/20 text-primary text-xs rounded-xl font-medium">
                  ✓ Total group expenses: ₹{totalExpense.toLocaleString('en-IN')}. Individual share: ₹{share.toLocaleString('en-IN')}.
                </div>
              </div>
            </div>

            {/* Solver results list */}
            <div className="space-y-5">
              <h3 className="text-base font-bold flex items-center gap-2 border-b border-border pb-3">
                <span className="h-6 w-6 bg-primary/10 rounded flex items-center justify-center text-xs font-bold text-primary">2</span>
                <span>Optimized Settlement Path</span>
              </h3>

              <div className="space-y-3 min-h-[160px] flex flex-col justify-center">
                {solverResults.map((t, idx) => (
                  <div key={idx} className="bg-secondary/40 border border-border p-4 rounded-xl flex items-center justify-between text-sm animate-fadeIn">
                    <span className="text-foreground/90 font-medium">
                      <strong>{t.from}</strong> pays <strong>{t.to}</strong>
                    </span>
                    <span className="font-extrabold text-primary font-mono text-sm">
                      ₹{t.amount.toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}

                {solverResults.length === 0 && Math.abs(sumOfBalances) < 0.01 && (
                  <div className="text-center py-8 text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                    ✓ All balances settled. No transfers required!
                  </div>
                )}

                {solverResults.length === 0 && Math.abs(sumOfBalances) >= 0.01 && (
                  <div className="text-center py-8 text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                    Adjust the sliders above to generate a settlement plan.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack Info Section */}
      <section id="tech-stack" className="py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="text-3xl font-bold tracking-tight">Full-Stack Relational Architecture</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                SplitEx is built using a highly decoupled architecture designed to offer high scalability. It relies on a typed database connection schema to ensure full data auditability.
              </p>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="h-5 w-5 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5 text-primary font-bold text-xs">✓</div>
                  <p className="text-sm text-foreground font-medium">React, Vite, Tailwind CSS, & Shadcn UI Design System</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-5 w-5 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5 text-primary font-bold text-xs">✓</div>
                  <p className="text-sm text-foreground font-medium">Express.js, TypeScript, & Prisma ORM backend</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-5 w-5 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5 text-primary font-bold text-xs">✓</div>
                  <p className="text-sm text-foreground font-medium">Cloud Neon PostgreSQL schema with SQLite local fallback</p>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border p-6 rounded-2xl glass-panel space-y-4 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <span className="text-muted-foreground">schema.prisma</span>
                <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded font-semibold uppercase">SQLite</span>
              </div>
              <pre className="text-muted-foreground/90 overflow-x-auto">
{`model GroupMembership {
  id        String    @id @default(uuid())
  groupId   String
  userId    String
  joinedAt  DateTime
  leftAt    DateTime?
  
  group     Group     @relation(fields: [groupId], ...)
  user      User      @relation(fields: [userId], ...)
}

model Expense {
  id        String    @id @default(uuid())
  amount    Decimal
  currency  String    @default("INR")
  splitType String    @default("EQUAL")
}`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Footer Section */}
      <footer className="mt-auto border-t border-border/40 py-8 bg-background">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>© 2026 SplitEx Expense Manager. Designed for excellence.</p>
          <div className="flex items-center gap-6">
            <span>Privacy & Security</span>
            <span>Instant Local Sync</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
