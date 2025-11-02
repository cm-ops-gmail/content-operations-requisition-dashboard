
"use client";

import { useState, useEffect } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { submitTicket, getFormQuestions } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CalendarIcon } from 'lucide-react';
import type { FormQuestion } from '@/lib/mock-data';
import { Checkbox } from './ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

// Component to render the correct form field based on question type
const FormFieldBuilder = ({ question, form, team }: { question: FormQuestion, form: UseFormReturn<any>, team: string }) => {
    const isRequired = question.questionText.endsWith('*');
    const label = question.questionText.replace(/\*$/, '').replace(/\s\((select:|checkbox:).*?\)/i, '');
    
    let fieldComponent;

    switch (question.questionType) {
        case 'Text':
        case 'Url':
            fieldComponent = (
                <FormField
                    control={form.control}
                    name={question.questionText}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{label}{isRequired && ' *'}</FormLabel>
                            <FormControl>
                                <Input 
                                  placeholder={`Enter ${label.toLowerCase()}`} 
                                  type={question.questionType === 'Url' ? 'url' : 'text'}
                                  {...field} 
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            );
            break;
        case 'Date':
             fieldComponent = (
                <FormField
                    control={form.control}
                    name={question.questionText}
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>{label}{isRequired && ' *'}</FormLabel>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <FormControl>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-full pl-3 text-left font-normal",
                                                !field.value && "text-muted-foreground"
                                            )}
                                        >
                                            {field.value ? (
                                                format(field.value, "PPP")
                                            ) : (
                                                <span>Pick a date</span>
                                            )}
                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                        </Button>
                                    </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={field.value}
                                        onSelect={field.onChange}
                                        disabled={(date) =>
                                            date > new Date() || date < new Date("1900-01-01")
                                        }
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            );
            break;
        case 'Textarea':
             fieldComponent = (
                <FormField
                    control={form.control}
                    name={question.questionText}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{label}{isRequired && ' *'}</FormLabel>
                            <FormControl>
                                <Textarea placeholder="Describe in detail..." {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            );
            break;
        case 'Select':
            fieldComponent = (
                <FormField
                    control={form.control}
                    name={question.questionText}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{label}{isRequired && ' *'}</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder={`Select a ${label.toLowerCase()}`} />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {question.options?.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            );
            break;
        case 'Checkbox':
            fieldComponent = (
                <FormField
                    control={form.control}
                    name={question.questionText}
                    render={() => (
                         <FormItem>
                           <div className="mb-4">
                            <FormLabel>{label}{isRequired && ' *'}</FormLabel>
                           </div>
                           {question.options?.map((option) => (
                             <FormField
                               key={option}
                               control={form.control}
                               name={`${question.questionText}.${option}`}
                               render={({ field }) => (
                                 <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                   <FormControl>
                                     <Checkbox
                                       checked={field.value}
                                       onCheckedChange={field.onChange}
                                     />
                                   </FormControl>
                                   <FormLabel className="font-normal">
                                     {option}
                                   </FormLabel>
                                 </FormItem>
                               )}
                             />
                           ))}
                           <FormMessage />
                         </FormItem>
                    )}
                />
            );
            break;
        default:
            fieldComponent = null;
    }
    return fieldComponent;
};

export function TicketForm({ teams, workType }: { teams: string[]; workType: string; }) {
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formQuestions, setFormQuestions] = useState<FormQuestion[]>([]);
    const { toast } = useToast();
    
    // Dynamically generate the form schema from questions
    const formSchema = z.object({
        Team: z.string(),
        'Work Type': z.string(),
        ...formQuestions.reduce((schema, q) => {
            const isRequired = q.questionText.endsWith('*');
            const questionKey = q.questionText;

            if (q.questionType === 'Checkbox') {
                const checkboxGroupSchema = z.object(
                  (q.options || []).reduce((acc, option) => {
                    acc[option] = z.boolean().default(false);
                    return acc;
                  }, {} as Record<string, z.ZodBoolean>)
                );
                schema[questionKey] = isRequired ? checkboxGroupSchema.refine(data => Object.values(data).some(v => v), { message: "At least one option must be selected."}) : checkboxGroupSchema;
            } else if (q.questionType === 'Date') {
                 schema[questionKey] = isRequired ? z.date({ required_error: "A date is required."}) : z.date().optional();
            } else {
                 schema[questionKey] = isRequired ? z.string().min(1, 'This field is required.') : z.string().optional();
            }
            return schema;
        }, {} as Record<string, any>)
    });

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            Team: teams.join(', '),
            'Work Type': workType,
        },
    });
    
    useEffect(() => {
        if (!teams || teams.length === 0) {
            setFormQuestions([]);
            setIsLoading(false);
            return;
        };
        
        setIsLoading(true);

        const fetchAllQuestions = async () => {
            const allQuestions = await Promise.all(
                teams.map(team => getFormQuestions(team))
            );
            const flattenedQuestions = allQuestions.flat();
            
            // Remove duplicates by questionText
            const uniqueQuestions = flattenedQuestions.filter((question, index, self) =>
                index === self.findIndex((q) => (
                    q.questionText === question.questionText
                ))
            );

            setFormQuestions(uniqueQuestions);

            const defaultValues = uniqueQuestions.reduce((acc, q) => {
                const questionKey = q.questionText;
                if (q.questionType === 'Checkbox') {
                     acc[questionKey] = (q.options || []).reduce((optionsAcc, option) => {
                        optionsAcc[option] = false;
                        return optionsAcc;
                    }, {} as Record<string, boolean>);
                } else if (q.questionType !== 'Date') {
                    acc[questionKey] = '';
                }
                return acc;
            }, {} as Record<string, any>);
            
            form.reset({ Team: teams.join(', '), 'Work Type': workType, ...defaultValues });
            setIsLoading(false);
        };
        
        fetchAllQuestions();
    }, [teams, workType]);


    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsSubmitting(true);

        const processedValues: Record<string, any> = { ...values, Team: teams.join(', ') };
        
        formQuestions.forEach(q => {
            const value = processedValues[q.questionText];
            // Convert checkbox group data to a comma-separated string for submission
            if (q.questionType === 'Checkbox' && value) {
                processedValues[q.questionText] = Object.entries(value)
                    .filter(([, checked]) => checked)
                    .map(([option]) => option)
                    .join(', ');
            }
            // Format date objects to a string
            if (q.questionType === 'Date' && value instanceof Date) {
                 processedValues[q.questionText] = format(value, 'yyyy-MM-dd');
            }
        });

        const submissionResult = await submitTicket(processedValues);

        if (submissionResult.success) {
            toast({
                title: 'Ticket Submitted!',
                description: 'Your ticket has been submitted successfully.',
            });
            const defaultQuestionValues = formQuestions.reduce((acc, q) => {
                if (q.questionType === 'Checkbox') {
                    acc[q.questionText] = {};
                } else if (q.questionType !== 'Date') {
                    acc[q.questionText] = '';
                } else {
                    acc[q.questionText] = undefined;
                }
                return acc;
            }, {} as Record<string, any>);
            form.reset({ Team: teams.join(', '), 'Work Type': workType, ...defaultQuestionValues });
        } else {
            toast({
                variant: 'destructive',
                title: 'Submission Error',
                description: submissionResult.error || 'Failed to submit ticket to Google Sheet.',
            });
        }
        setIsSubmitting(false);
    }

    if (isLoading) {
        return <div className="flex justify-center items-center p-8"><Loader2 className="mr-2 h-8 w-8 animate-spin" /> Loading form...</div>
    }

    if (formQuestions.length === 0 && !isLoading) {
        return <p className="text-center text-muted-foreground">No form questions have been configured for the selected team(s).</p>
    }

    return (
        <Card>
            <CardContent className="p-6">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        {formQuestions.map(question => (
                            <FormFieldBuilder key={question.id} question={question} form={form} team={teams[0]} />
                        ))}
                        <Button type="submit" disabled={isSubmitting} className="w-full">
                            {isSubmitting ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                'Submit Ticket'
                            )}
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}
