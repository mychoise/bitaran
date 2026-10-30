"use client";

// Product categories: add, rename, and delete only when no product uses one.

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Card, PageHeader } from "@/components/ui/Display";
import { Input } from "@/components/ui/Field";
import { BackLink, FormProblem } from "@/components/ui/Form";
import { ConfirmDialog, Modal, useToast } from "@/components/ui/Overlay";
import { Table, type Column } from "@/components/ui/Table";
import { ApiError } from "@/lib/api/client";
import { errorMessage, useApiMutation, useApiQuery } from "@/lib/api/provider";
import { categoryNameField } from "@/lib/api/schemas";
import type { Category } from "@/lib/api/types";
import { zodResolver } from "@/lib/forms";

const nameSchema = z.object({ name: categoryNameField });
type NameValues = z.infer<typeof nameSchema>;
const AFFECTS = [["categories"], ["products"]];

export function CategoryList() {
  const q = useApiQuery(["categories", "list"], (api) => api.categories.list());
  const [renaming, setRenaming] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);

  const columns: Column<Category>[] = [
    { key: "name", header: "Name", rowHeader: true, cell: (c) => c.name, sortValue: (c) => c.name },
    { key: "count", header: "Products", numeric: true, cell: (c) => c.productCount, sortValue: (c) => c.productCount },
    {
      key: "actions",
      header: "Actions",
      cell: (c) => (
        <span className="flex flex-wrap items-center gap-2">
          <Button variant="quiet" size="sm" onClick={() => setRenaming(c)} aria-label={`Rename ${c.name}`}>
            Rename
          </Button>
          {c.productCount === 0 ? (
            <Button variant="quiet" size="sm" onClick={() => setDeleting(c)} aria-label={`Delete ${c.name}`}>
              Delete
            </Button>
          ) : (
            <span className="text-sm text-muted">In use, cannot be deleted</span>
          )}
        </span>
      ),
    },
  ];

  return (
    <>
      <BackLink href="/app/manager/products" label="Products and stock" />
      <PageHeader title="Categories" lead="Group products so they are easier to find. A category in use cannot be deleted." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <div className="lg:col-span-2">
          <Table
            caption="Categories"
            columns={columns}
            rows={q.data}
            rowKey={(c) => c.id}
            loading={q.isPending}
            error={q.isError ? errorMessage(q.error) : null}
            onRetry={() => q.refetch()}
            empty={{ title: "No categories yet", line: "Add one to start adding products." }}
          />
        </div>
        <AddCategory />
      </div>
      {renaming ? <RenameCategory category={renaming} onClose={() => setRenaming(null)} /> : null}
      <DeleteCategory category={deleting} onClose={() => setDeleting(null)} />
    </>
  );
}

function AddCategory() {
  const toast = useToast();
  const [problem, setProblem] = useState<string | null>(null);
  const { register, handleSubmit, setError, reset, formState } = useForm<NameValues>({ resolver: zodResolver(nameSchema), defaultValues: { name: "" } });
  const create = useApiMutation((api, name: string) => api.categories.create(name), AFFECTS);
  const onSubmit = handleSubmit(async ({ name }) => {
    setProblem(null);
    try {
      const c = await create.mutateAsync(name);
      reset();
      toast(`${c.name} added.`);
    } catch (e) {
      if (e instanceof ApiError && e.code === "conflict") setError("name", { message: e.message }, { shouldFocus: true });
      else setProblem(errorMessage(e));
    }
  });
  return (
    <Card as="section" dense>
      <h2 className="text-title tracking-normal">Add a category</h2>
      <form onSubmit={onSubmit} noValidate className="mt-4">
        <Input label="Name" autoComplete="off" error={formState.errors.name?.message} {...register("name")} />
        <Button type="submit" loading={formState.isSubmitting} loadingLabel="Adding…">
          Add category
        </Button>
        <FormProblem message={problem} />
      </form>
    </Card>
  );
}

function RenameCategory({ category, onClose }: { category: Category; onClose: () => void }) {
  const toast = useToast();
  const [problem, setProblem] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState } = useForm<NameValues>({ resolver: zodResolver(nameSchema), defaultValues: { name: category.name } });
  const rename = useApiMutation((api, name: string) => api.categories.rename(category.id, name), AFFECTS);
  const onSubmit = handleSubmit(async ({ name }) => {
    setProblem(null);
    try {
      const c = await rename.mutateAsync(name);
      onClose();
      toast(`Renamed to ${c.name}.`);
    } catch (e) {
      if (e instanceof ApiError && e.code === "conflict") setError("name", { message: e.message }, { shouldFocus: true });
      else setProblem(errorMessage(e));
    }
  });
  return (
    <Modal
      open
      onClose={onClose}
      title={`Rename ${category.name}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Go back
          </Button>
          <Button type="submit" form="rename-category" loading={formState.isSubmitting} loadingLabel="Saving…">
            Save name
          </Button>
        </>
      }
    >
      <form id="rename-category" onSubmit={onSubmit} noValidate>
        <Input label="Name" autoComplete="off" error={formState.errors.name?.message} {...register("name")} />
        <FormProblem message={problem} />
      </form>
    </Modal>
  );
}

function DeleteCategory({ category, onClose }: { category: Category | null; onClose: () => void }) {
  const toast = useToast();
  const remove = useApiMutation((api, id: string) => api.categories.remove(id), AFFECTS);
  const onConfirm = async () => {
    if (!category) return;
    try {
      await remove.mutateAsync(category.id);
      toast(`${category.name} deleted.`);
    } catch (e) {
      toast(errorMessage(e), "info");
    } finally {
      onClose();
    }
  };
  return (
    <ConfirmDialog
      open={category !== null}
      onClose={onClose}
      onConfirm={onConfirm}
      busy={remove.isPending}
      danger
      title={`Delete ${category?.name ?? "this category"}?`}
      consequence="No product uses it, so nothing else changes. This cannot be undone."
      confirmLabel="Delete category"
    />
  );
}
