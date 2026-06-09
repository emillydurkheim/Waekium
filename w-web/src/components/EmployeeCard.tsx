import type { Employee } from "@/lib/storage"; // importa a tipagem Employee

export function EmployeeCard({ // componente do card do funcionário
  employee, // dados do funcionário
  selected, // verifica se está selecionado
  onClick, // função ao clicar
}: {
  employee: Employee; // tipo Employee
  selected: boolean; // true ou false
  onClick: () => void; // função sem retorno
}) {

  const initial = employee.name.charAt(0).toUpperCase(); // pega primeira letra do nome

  return (
    <button
      onClick={onClick} // executa ao clicar

      className={`relative flex flex-col items-center gap-1.5 rounded-xl border bg-card px-3 py-3 text-center transition-all ${
        selected // verifica se está selecionado

          ? "border-foreground/30 bg-secondary shadow-sm" // estilo selecionado

          : "border-border hover:border-foreground/20" // estilo normal
      }`}
    >

      {selected && ( // mostra bolinha se estiver selecionado

        <span className="absolute left-2 top-2 h-2 w-2 rounded-full bg-foreground" />
      )}

      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-base font-medium text-muted-foreground">
        {initial} {/* primeira letra do nome */}
      </div>

      <div className="min-w-0">

        <div className="truncate text-xs font-medium text-foreground">
          {employee.name} {/* nome funcionário */}
        </div>

        <div className="truncate text-[11px] text-muted-foreground">
          {employee.role} {/* cargo funcionário */}
        </div>
      </div>
    </button>
  );
}