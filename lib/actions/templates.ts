"use server";

import { revalidatePath } from "next/cache";
import {
  type CreateTemplateInput,
  createTemplate,
  deleteTemplate,
  incrementTemplateUsage,
  updateTemplate,
} from "@/lib/db/queries";
import type { PromptTemplateRow } from "@/lib/db/schema";
import { extractTemplateVariables } from "@/lib/templates";

export async function createTemplateAction(
  input: Omit<CreateTemplateInput, "id" | "variables">,
): Promise<PromptTemplateRow> {
  const template = createTemplate({
    id: crypto.randomUUID(),
    ...input,
    variables: extractTemplateVariables(input.body),
  });
  revalidatePath("/templates");
  return template;
}

export async function updateTemplateAction(
  id: string,
  patch: Partial<Pick<PromptTemplateRow, "category" | "title" | "body">>,
) {
  const next: Partial<
    Pick<PromptTemplateRow, "category" | "title" | "body" | "variables">
  > = { ...patch };
  if (patch.body !== undefined) {
    next.variables = extractTemplateVariables(patch.body);
  }
  updateTemplate(id, next);
  revalidatePath("/templates");
}

export async function useTemplateAction(id: string) {
  incrementTemplateUsage(id);
  revalidatePath("/templates");
}

export async function deleteTemplateAction(id: string) {
  deleteTemplate(id);
  revalidatePath("/templates");
}
