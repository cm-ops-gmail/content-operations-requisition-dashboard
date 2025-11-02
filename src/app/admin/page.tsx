
'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { getFormQuestions, addFormQuestion, updateFormQuestion, deleteFormQuestion, getTeams, addTeam } from '../actions';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Trash2, Edit } from 'lucide-react';
import type { FormQuestion } from '@/lib/mock-data';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/use-auth';

export default function AdminPage() {
  const { user } = useAuth();
  
  const [teams, setTeams] = useState<string[]>([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  
  const [formQuestions, setFormQuestions] = useState<FormQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingTeams, setIsLoadingTeams] = useState(true);
  const [error, setError] = useState('');

  const [isQuestionDialogOpen, setIsQuestionDialogOpen] = useState(false);
  const [isTeamDialogOpen, setIsTeamDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [editingQuestion, setEditingQuestion] = useState<FormQuestion | null>(null);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newQuestionType, setNewQuestionType] = useState<FormQuestion['questionType']>('Text');
  const [isQuestionRequired, setIsQuestionRequired] = useState(false);
  const [checkboxOptions, setCheckboxOptions] = useState('');
  const [selectOptions, setSelectOptions] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  
  const { toast } = useToast();

  const fetchTeams = async () => {
    setIsLoadingTeams(true);
    try {
        const fetchedTeams = await getTeams();
        setTeams(fetchedTeams);
        if (fetchedTeams.length > 0 && !selectedTeam) {
            setSelectedTeam(fetchedTeams[0]);
        }
    } catch(err) {
        console.error(err);
        setError("Failed to load teams.");
    } finally {
        setIsLoadingTeams(false);
    }
  }

  useEffect(() => {
    fetchTeams();
  }, []);


  const fetchQuestions = async (team: string) => {
    if (!team) {
      setFormQuestions([]);
      return;
    };
    setIsLoading(true);
    setError('');
    try {
      const questions = await getFormQuestions(team);
      setFormQuestions(questions);
    } catch (err) {
      console.error(err);
      setError("Failed to load questions from Google Sheet.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedTeam) {
      fetchQuestions(selectedTeam);
    }
  }, [selectedTeam]);
  
  const handleOpenQuestionDialog = (question: FormQuestion | null = null) => {
    setEditingQuestion(question);
    if (question) {
        const cleanText = question.questionText.replace(/\*$/, '').replace(/\s\((select:|checkbox:).*?\)/i, '');
        setNewQuestionText(cleanText);
        setNewQuestionType(question.questionType);
        setIsQuestionRequired(question.questionText.endsWith('*'));
        if (question.questionType === 'Checkbox') {
          setCheckboxOptions(question.options?.join('; ') || '');
          setSelectOptions('');
        } else if (question.questionType === 'Select') {
          setSelectOptions(question.options?.join('; ') || '');
          setCheckboxOptions('');
        } else {
          setCheckboxOptions('');
          setSelectOptions('');
        }
    } else {
        setNewQuestionText('');
        setNewQuestionType('Text');
        setIsQuestionRequired(false);
        setCheckboxOptions('');
        setSelectOptions('');
    }
    setIsQuestionDialogOpen(true);
  }

  const handleQuestionFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    let finalQuestionText = newQuestionText;
    
    if (newQuestionType === 'Select') {
      const options = selectOptions.split(';').map(o => o.trim()).filter(Boolean);
      if (options.length > 0) {
        finalQuestionText += ` (Select: ${options.join(';')})`;
      }
    } else if (newQuestionType === 'Checkbox') {
      const options = checkboxOptions.split(';').map(o => o.trim()).filter(Boolean);
      if (options.length > 0) {
        finalQuestionText += ` (Checkbox: ${options.join(';')})`;
      }
    }
    
    if (isQuestionRequired) {
        finalQuestionText += '*';
    }
    
    let result;
    if (editingQuestion) {
      result = await updateFormQuestion(selectedTeam, editingQuestion.questionText, finalQuestionText);
    } else {
      result = await addFormQuestion(selectedTeam, finalQuestionText);
    }

    if (result.success) {
      toast({
        title: 'Success!',
        description: `Question has been ${editingQuestion ? 'updated' : 'added'}.`,
      });
      setIsQuestionDialogOpen(false);
      await fetchQuestions(selectedTeam);
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: result.error || 'An unknown error occurred.',
      });
    }
    setIsSubmitting(false);
  };
  
  const handleTeamFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) {
        toast({ variant: 'destructive', title: 'Error', description: "Team name cannot be empty." });
        return;
    }
    setIsSubmitting(true);
    const result = await addTeam(newTeamName.trim());
     if (result.success) {
      toast({
        title: 'Success!',
        description: `Team "${newTeamName}" has been created.`,
      });
      setIsTeamDialogOpen(false);
      setNewTeamName('');
      await fetchTeams();
      setSelectedTeam(newTeamName.trim());
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: result.error || 'An unknown error occurred.',
      });
    }
    setIsSubmitting(false);
  }

  const handleDelete = async (questionText: string) => {
    const result = await deleteFormQuestion(selectedTeam, questionText);
     if (result.success) {
      toast({
        title: 'Success!',
        description: 'Question has been deleted.',
      });
      await fetchQuestions(selectedTeam);
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: result.error || 'Failed to delete question.',
      });
    }
  }
  
  const canManage = user?.role === 'admin';

  return (
    <>
      <div className="container mx-auto py-8 px-4 md:px-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Manage Form Questions</h1>
           {canManage && (
             <div className="flex gap-2">
                <Dialog open={isTeamDialogOpen} onOpenChange={setIsTeamDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <PlusCircle className="mr-2" /> Add Team
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Team</DialogTitle>
                    </DialogHeader>
                     <form onSubmit={handleTeamFormSubmit}>
                        <div className="py-4">
                            <Label htmlFor="new-team-name">Team Name</Label>
                            <Input 
                                id="new-team-name"
                                value={newTeamName}
                                onChange={(e) => setNewTeamName(e.target.value)}
                                placeholder="e.g., Engineering"
                            />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => setIsTeamDialogOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Add Team
                            </Button>
                        </DialogFooter>
                     </form>
                  </DialogContent>
                </Dialog>
                <Dialog open={isQuestionDialogOpen} onOpenChange={setIsQuestionDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => handleOpenQuestionDialog()} disabled={!selectedTeam}>
                      <PlusCircle className="mr-2" />
                      Add New Question
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                      <DialogTitle>{editingQuestion ? 'Edit' : 'Add New'} Form Question for {selectedTeam}</DialogTitle>
                      <DialogDescription>
                        This will {editingQuestion ? 'modify an entry in' : 'add a new row to'} the 'FormQuestions' sheet.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleQuestionFormSubmit}>
                      <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto pr-4">
                        <div>
                          <Label htmlFor="new-question-text">Question Text</Label>
                          <Input
                            id="new-question-text"
                            value={newQuestionText}
                            onChange={(e) => setNewQuestionText(e.target.value)}
                            placeholder="e.g., Contact Number"
                          />
                        </div>
                        <div>
                          <Label htmlFor="new-question-type">Question Type</Label>
                            <Select value={newQuestionType} onValueChange={(value) => setNewQuestionType(value as FormQuestion['questionType'])}>
                              <SelectTrigger id="new-question-type">
                                  <SelectValue placeholder="Select a type" />
                              </SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="Text">Text</SelectItem>
                                  <SelectItem value="Textarea">Textarea</SelectItem>
                                  <SelectItem value="Select">Select (Dropdown)</SelectItem>
                                  <SelectItem value="Checkbox">Checkbox</SelectItem>
                                  <SelectItem value="Date">Date</SelectItem>
                                  <SelectItem value="Url">URL</SelectItem>
                              </SelectContent>
                          </Select>
                        </div>
                        {newQuestionType === 'Select' && (
                            <div>
                                <Label htmlFor="select-options">Dropdown Options</Label>
                                <Textarea 
                                    id="select-options"
                                    value={selectOptions}
                                    onChange={(e) => setSelectOptions(e.target.value)}
                                    placeholder="Enter semicolon-separated options, e.g., Option A; Option B"
                                />
                                <p className="text-xs text-muted-foreground mt-1">Options for the dropdown menu.</p>
                            </div>
                        )}
                        {newQuestionType === 'Checkbox' && (
                          <div>
                            <Label htmlFor="checkbox-options">Checkbox Options</Label>
                            <Textarea 
                                id="checkbox-options"
                                value={checkboxOptions}
                                onChange={(e) => setCheckboxOptions(e.target.value)}
                                placeholder="Enter semicolon-separated options, e.g., Option A; Option B"
                            />
                             <p className="text-xs text-muted-foreground mt-1">Options for the checkbox group.</p>
                          </div>
                        )}
                        <div className="flex items-center space-x-2">
                            <Checkbox id="is-required" checked={isQuestionRequired} onCheckedChange={(checked) => setIsQuestionRequired(Boolean(checked))} />
                            <label
                                htmlFor="is-required"
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                                Make this question required
                            </label>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => setIsQuestionDialogOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting}>
                          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {editingQuestion ? 'Save Changes' : 'Add Question'}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
             </div>
           )}
        </div>

        <Card className="mb-6">
            <CardContent className="p-4">
                 <Label htmlFor="team-select">Select Team to Manage Questions</Label>
                 {isLoadingTeams ? (
                     <div className="flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading teams...</div>
                 ) : (
                    <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                        <SelectTrigger id="team-select">
                            <SelectValue placeholder="Select a team..." />
                        </SelectTrigger>
                        <SelectContent>
                            {teams.map(team => (
                                <SelectItem key={team} value={team}>{team}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                 )}
            </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Questions for {selectedTeam || "..."}</CardTitle>
            <CardDescription>
                These questions are managed in the 'FormQuestions' sheet of your Google Sheet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
                <div className="flex justify-center items-center py-8"><Loader2 className="mr-2 h-8 w-8 animate-spin" /> Loading questions...</div>
            ) : error ? (
                <p className="text-destructive text-center py-8">{error}</p>
            ) : !selectedTeam ? (
                <p className="text-muted-foreground text-center py-8">Please select a team to see its questions.</p>
            ) : formQuestions.length === 0 ? (
                 <p className="text-muted-foreground text-center py-8">No questions found for this team. Add one to get started.</p>
            ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Question Text</TableHead>
                  <TableHead>Question Type</TableHead>
                  <TableHead>Required</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {formQuestions.map((question) => (
                  <TableRow key={question.id}>
                    <TableCell className="font-medium">{question.questionText.replace(/\*$/, '').replace(/\s\((select:|checkbox:).*?\)/i, '')}</TableCell>
                    <TableCell>{question.questionType}</TableCell>
                    <TableCell>{question.questionText.endsWith('*') ? 'Yes' : 'No'}</TableCell>
                    <TableCell className="text-right">
                        {canManage ? (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => handleOpenQuestionDialog(question)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the question from the 'FormQuestions' sheet.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(question.questionText)}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
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
    </>
  );
}
    
