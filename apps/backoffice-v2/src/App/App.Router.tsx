import { ReactRouter as TanStackRouter, RouterProvider } from '@tanstack/react-router';
import React, { FunctionComponent } from 'react';
import { rootRoute } from '../routes/Root/Root.route';
import { caseManagementRoute } from '../routes/CaseManagement/CaseManagement.route';
import { caseManagementIndexRoute } from '../routes/CaseManagement/CaseManagementIndex.route';
import { entitiesRoute } from '../routes/Entities/Entities.route';
import { entityRoute } from '../routes/Entity/Entity.route';
import { rootIndexRoute } from '../routes/Root/RootIndex.route';
import { signInRoute } from '../routes/SignIn/SignIn.route';
import { entitiesIndexRoute } from '../routes/Entities/EntitiesIndex.route';
import { env } from '../common/env/env';
import {
  createBrowserRouter,
  Outlet,
  redirect,
  RouterProvider as ReactRouterProvider,
} from 'react-router-dom';
import { RootError } from '../routes/Root/Root.error';
import { Root } from '../routes/Root/Root.page';
import { authQueryKeys } from '../domains/auth/query-keys';
import { queryClient } from '../lib/react-query/query-client';
import { filtersQueryKeys } from '../domains/filters/query-keys';
import { SignIn } from '../routes/SignIn/SignIn.page';
import { usersQueryKeys } from '../domains/users/query-keys';
import { Entities } from '../routes/Entities/Entities.page';
import { Entity } from '../routes/Entity/Entity.page';
import { queryKeys } from '../domains/entities/query-keys';

declare module '@tanstack/react-router' {
  interface Register {
    // @ts-ignore
    router: typeof router;
  }
}

const routes = [
  rootIndexRoute,
  ...(env.VITE_AUTH_ENABLED ? [signInRoute] : []),
  caseManagementRoute.addChildren([
    caseManagementIndexRoute,
    entitiesRoute.addChildren([entitiesIndexRoute, entityRoute]),
    // transactionsRoute.addChildren([transactionsIndexRoute]),
  ]),
];

// Declare the routes and their children routes
const routeTree = rootRoute.addChildren(routes);

// Router to pass to the RouterProvider
export const router = new TanStackRouter({
  routeTree,
  defaultPreload: 'intent',
});

// Used by App, exported here in case we want to include more providers in App or run logic before the RouterProvider
export const Router: FunctionComponent = () => {
  return <RouterProvider router={router} />;
};

const reactRouter = createBrowserRouter([
  {
    path: '/',
    element: <Root />,
    loader({ request }) {
      const url = new URL(request.url);

      if (url.pathname.startsWith('/en')) return null;

      return redirect(`/en${url.pathname === '/' ? '' : url.pathname}`);
    },
    errorElement: <RootError />,
    children: [
      ...(env.VITE_AUTH_ENABLED
        ? [
            {
              path: '/:locale/auth/sign-in',
              element: <SignIn />,
            },
          ]
        : []),
      {
        path: '/:locale',
        element: <Outlet />,
        async loader({ request }) {
          if (!env.VITE_AUTH_ENABLED) return null;

          const url = new URL(request.url);
          const authenticatedUser = authQueryKeys.authenticatedUser();
          const session = await queryClient.ensureQueryData(
            authenticatedUser.queryKey,
            authenticatedUser.queryFn,
          );

          if (!session?.user) return null;

          const filtersList = filtersQueryKeys.list();
          const filters = await queryClient.ensureQueryData(
            filtersList.queryKey,
            filtersList.queryFn,
          );

          if (!url.searchParams.has('entity') && filters?.length) {
            const [{ id, entity, name }] = filters;

            return redirect(`${url.pathname}?filterId=${id}&entity=${entity}&filterName=${name}`);
          }

          return null;
        },
        children: [
          {
            path: '/:locale/case-management',
            element: <Outlet />,
            children: [
              {
                path: '/:locale/case-management/entities',
                element: <Entities />,
                async loader({ request }) {
                  const url = new URL(request.url);
                  const entity = url?.searchParams?.get('entity');
                  const filterId = url?.searchParams?.get('filterId');

                  if (!entity || !filterId) return null;

                  const entityList = queryKeys[entity].list(filterId);
                  const usersList = usersQueryKeys.list();
                  await queryClient.ensureQueryData(entityList.queryKey, entityList.queryFn);
                  await queryClient.ensureQueryData(usersList.queryKey, usersList.queryFn);

                  return null;
                },
                children: [
                  {
                    path: '/:locale/case-management/entities/:entityId',
                    element: <Entity />,
                    async loader({ params, request }) {
                      const url = new URL(request.url);
                      const { entityId } = params;
                      const entity = url?.searchParams?.get('entity');
                      const filterId = url?.searchParams?.get('filterId');

                      if (entity || !filterId) return null;

                      const entityById = queryKeys[entity].byId(entityId, filterId);
                      // TODO: Add workflowId to params/searchParams
                      // const workflowById = workflows.byId({ workflowId });

                      await queryClient.ensureQueryData(entityById.queryKey, entityById.queryFn);

                      // await queryClient.ensureQueryData(workflowById.queryKey, workflowById.queryFn);

                      return null;
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
]);

export const ReactRouter: FunctionComponent = () => {
  return <ReactRouterProvider router={reactRouter} />;
};
