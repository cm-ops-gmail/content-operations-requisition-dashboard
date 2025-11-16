
'use client';

import { useState, useEffect, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Loader2, PlusCircle, Trash2, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { getWorkTypes, addWorkTypeOption, updateWorkTypeOption, deleteWorkTypeOption, updateWorkTypeQuestion } from '@/app/actions';

export default function WorkTypesPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [workTypeInfo, setWorkTypeInfo] = useState<{ question: string; options: string[] }>({ question: '', options: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [isQuestionDialogOpen, setIsQuestionDialogOpen] = useState(false);
  const [isOptionDialogOpen, setIsOptionDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [newQuestion, setNewQuestion] = useState('');
  const [newOption, setNewOption] = useState('');
  const [editingOption, setEditingOption] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await getWorkTypes();
      setWorkTypeInfo(data);
      setNewQuestion(data.question);
    } catch (err) {
      console.error(err);
      setError("Failed to load work types from Google Sheet (WorkTypes).");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleQuestionSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const result = await updateWorkTypeQuestion(newQuestion);
    if (result.success) {
      toast({ title: 'Success!', description: 'The question has been updated.' });
      setIsQuestionDialogOpen(false);
      await fetchData();
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error || 'Failed to update the question.' });
    }
    setIsSubmitting(false);
  };
  
  const handleOpenOptionDialog = (option: string | null = null) => {
    setEditingOption(option);
    setNewOption(option || '');
    setIsOptionDialogOpen(true);
  };

  const handleOptionSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    let result;
    if (editingOption) {
      result = await updateWorkTypeOption(editingOption, newOption);
    } else {
      result = await addWorkTypeOption(newOption);
    }

    if (result.success) {
      toast({ title: 'Success!', description: `Option has been ${editingOption ? 'updated' : 'added'}.` });
      setIsOptionDialogOpen(false);
      await fetchData();
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error || 'An unknown error occurred.' });
    }
    setIsSubmitting(false);
  };
  
  const handleDeleteOption = async (option: string) => {
      const result = await deleteWorkTypeOption(option);
      if (result.success) {
          toast({ title: 'Success!', description: 'Option has been deleted.' });
          await fetchData();
      } else {
          toast({ variant: 'destructive', title: 'Error', description: result.error || 'Failed to delete option.' });
      }
  };

  const canManage = user?.role === 'admin' || user?.role === 'sub-admin';

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Manage Work Types</h1>
        {canManage && (
            <Dialog open={isOptionDialogOpen} onOpenChange={setIsOptionDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => handleOpenOptionDialog()}>
                  <PlusCircle className="mr-2" />
                  Add New Option
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingOption ? 'Edit' : 'Add New'} Work Type Option</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleOptionSubmit}>
                  <div className="py-4">
                    <Label htmlFor="new-option-text">Option Text</Label>
                    <Input id="new-option-text" value={newOption} onChange={(e) => setNewOption(e.target.value)} placeholder="e.g., Critical" />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => setIsOptionDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingOption ? 'Save Changes' : 'Add Option'}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
        )}
      </div>

      <Card className="mb-6">
          <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>The Question</CardTitle>
                  <CardDescription>This is the question that appears above the dropdown on the ticket form.</CardDescription>
                </div>
                {canManage && (
                    <Dialog open={isQuestionDialogOpen} onOpenChange={setIsQuestionDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline"><Edit className="mr-2 h-4 w-4" /> Edit Question</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Edit Work Type Question</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleQuestionSubmit}>
                                <div className="py-4">
                                    <Label htmlFor="question-text">Question Text</Label>
                                    <Input id="question-text" value={newQuestion} onChange={(e) => setNewQuestion(e.target.value)} />
                                </div>
                                <DialogFooter>
                                    <Button type="button" variant="ghost" onClick={() => setIsQuestionDialogOpen(false)}>Cancel</Button>
                                    <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Changes</Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                )}
              </div>
          </CardHeader>
          <CardContent>
              <p className="text-lg font-semibold">{workTypeInfo.question || "Loading..."}</p>
          </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>The Options</CardTitle>
          <CardDescription>These are the options that appear in the dropdown menu. Managed in the 'WorkTypes' sheet.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-8"><Loader2 className="mr-2 h-8 w-8 animate-spin" /> Loading options...</div>
          ) : error ? (
            <p className="text-destructive text-center py-8">{error}</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Option Text</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {workTypeInfo.options.map((option) => (
                  <TableRow key={option}>
                    <TableCell className="font-medium">{option}</TableCell>
                    <TableCell className="text-right">
                      {canManage ? (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => handleOpenOptionDialog(option)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                           <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the option from the 'WorkTypes' sheet.</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteOption(option)}>Delete</AlertDialogAction></AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">No actions</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
