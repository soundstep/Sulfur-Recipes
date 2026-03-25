import { useGetRecipes, useRefreshRecipes, getGetRecipesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export function useRecipesData() {
  return useGetRecipes({
    query: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 mins
      retry: 1
    }
  });
}

export function useRefreshRecipesData() {
  const queryClient = useQueryClient();
  return useRefreshRecipes({
    mutation: {
      onSuccess: () => {
        // Invalidate the cache to trigger a refetch of the new data
        queryClient.invalidateQueries({ queryKey: getGetRecipesQueryKey() });
      }
    }
  });
}
