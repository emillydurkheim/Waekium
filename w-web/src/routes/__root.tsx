import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router"; // componentes e funções do TanStack Router

import appCss from "../styles.css?url"; // importa CSS global como URL

function NotFoundComponent() { // componente da página 404
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4"> {/* container centralizado */}
      <div className="max-w-md text-center"> {/* bloco conteúdo */}
        <h1 className="text-7xl font-bold text-foreground">404</h1> {/* código erro */}
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2> {/* título */}
        <p className="mt-2 text-sm text-muted-foreground"> {/* descrição */}
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6"> {/* espaço botão */}
          <Link
            to="/" // rota home
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90" // estilos botão
          >
            Go home {/* texto botão */}
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({ // cria rota principal aplicação
  head: () => ({ // configurações head HTML
    meta: [ // meta tags
      { charSet: "utf-8" }, // codificação caracteres
      { name: "viewport", content: "width=device-width, initial-scale=1" }, // responsividade
      { title: "Lovable App" }, // título site
      { name: "description", content: "Lovable Generated Project" }, // descrição
      { name: "author", content: "Lovable" }, // autor
      { property: "og:title", content: "Lovable App" }, // título compartilhamento
      { property: "og:description", content: "Lovable Generated Project" }, // descrição compartilhamento
      { property: "og:type", content: "website" }, // tipo site
      { name: "twitter:card", content: "summary" }, // card twitter
      { name: "twitter:site", content: "@Lovable" }, // twitter site
    ],
    links: [ // links externos
      {
        rel: "stylesheet", // define stylesheet
        href: appCss, // caminho CSS
      },
    ],
  }),
  shellComponent: RootShell, // componente base HTML
  component: RootComponent, // componente principal
  notFoundComponent: NotFoundComponent, // componente 404
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <HeadContent />
      {children}
      <Scripts />
    </>
  );
}

function RootComponent() { // componente principal rotas
  return <Outlet />; // renderiza rota atual
}