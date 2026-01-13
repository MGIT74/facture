'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import {
  MoreHorizontal,
  Download,
  Mail,
  Copy,
  Trash2,
  Check,
  X,
  FileText,
  ArrowRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface DocumentActionsProps {
  type: 'invoice' | 'quote'
  document: {
    id: string
    number: string
    status: string
    client_email?: string
    client_name?: string
  }
  onStatusChange?: (status: string) => void
  onDelete?: () => void
  onDuplicate?: () => void
  onConvertToInvoice?: () => void
}

export function DocumentActions({
  type,
  document,
  onStatusChange,
  onDelete,
  onDuplicate,
  onConvertToInvoice,
}: DocumentActionsProps) {
  const [emailDialogOpen, setEmailDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [convertDialogOpen, setConvertDialogOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const [emailForm, setEmailForm] = useState({
    recipient: document.client_email || '',
    subject: '',
    message: '',
  })

  const isInvoice = type === 'invoice'

  async function handleDownloadPDF() {
    setDownloading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        toast.error('Session expirée')
        return
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-pdf`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            type,
            id: document.id,
            lang: 'fr',
          }),
        }
      )

      const result = await response.json()

      if (result.error) {
        toast.error(result.error)
        return
      }

      const blob = new Blob([result.html], { type: 'text/html' })
      const url = URL.createObjectURL(blob)

      const printWindow = window.open(url, '_blank')
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print()
        }
      }

      toast.success('Document généré')
    } catch (error) {
      console.error('Error generating PDF:', error)
      toast.error('Erreur lors de la génération')
    } finally {
      setDownloading(false)
    }
  }

  async function handleSendEmail() {
    if (!emailForm.recipient) {
      toast.error('Veuillez saisir un destinataire')
      return
    }

    setSending(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        toast.error('Session expirée')
        return
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            type,
            id: document.id,
            recipientEmail: emailForm.recipient,
            subject: emailForm.subject || undefined,
            message: emailForm.message || undefined,
            lang: 'fr',
          }),
        }
      )

      const result = await response.json()

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success('Email envoyé avec succès')
      setEmailDialogOpen(false)
      onStatusChange?.('sent')
    } catch (error) {
      console.error('Error sending email:', error)
      toast.error('Erreur lors de l\'envoi')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleDownloadPDF} disabled={downloading}>
            <Download className="mr-2 h-4 w-4" />
            {downloading ? 'Génération...' : 'Télécharger / Imprimer'}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setEmailDialogOpen(true)}>
            <Mail className="mr-2 h-4 w-4" />
            Envoyer par email
          </DropdownMenuItem>
          {onDuplicate && (
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="mr-2 h-4 w-4" />
              Dupliquer
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {isInvoice ? (
            <>
              {document.status === 'draft' && (
                <DropdownMenuItem onClick={() => onStatusChange?.('sent')}>
                  <Mail className="mr-2 h-4 w-4" />
                  Marquer comme envoyée
                </DropdownMenuItem>
              )}
              {(document.status === 'sent' || document.status === 'overdue') && (
                <DropdownMenuItem onClick={() => onStatusChange?.('paid')}>
                  <Check className="mr-2 h-4 w-4" />
                  Marquer comme payée
                </DropdownMenuItem>
              )}
              {document.status !== 'cancelled' && document.status !== 'paid' && (
                <DropdownMenuItem onClick={() => onStatusChange?.('cancelled')}>
                  <X className="mr-2 h-4 w-4" />
                  Annuler
                </DropdownMenuItem>
              )}
            </>
          ) : (
            <>
              {document.status === 'draft' && (
                <DropdownMenuItem onClick={() => onStatusChange?.('sent')}>
                  <Mail className="mr-2 h-4 w-4" />
                  Marquer comme envoyé
                </DropdownMenuItem>
              )}
              {document.status === 'sent' && (
                <>
                  <DropdownMenuItem onClick={() => onStatusChange?.('accepted')}>
                    <Check className="mr-2 h-4 w-4" />
                    Marquer comme accepté
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onStatusChange?.('declined')}>
                    <X className="mr-2 h-4 w-4" />
                    Marquer comme refusé
                  </DropdownMenuItem>
                </>
              )}
              {document.status === 'accepted' && onConvertToInvoice && (
                <DropdownMenuItem onClick={() => setConvertDialogOpen(true)}>
                  <ArrowRight className="mr-2 h-4 w-4" />
                  Convertir en facture
                </DropdownMenuItem>
              )}
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setDeleteDialogOpen(true)}
            className="text-red-600"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Supprimer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Envoyer {isInvoice ? 'la facture' : 'le devis'} par email
            </DialogTitle>
            <DialogDescription>
              {isInvoice ? 'Facture' : 'Devis'} {document.number}
              {document.client_name && ` - ${document.client_name}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="recipient">Destinataire</Label>
              <Input
                id="recipient"
                type="email"
                value={emailForm.recipient}
                onChange={(e) => setEmailForm({ ...emailForm, recipient: e.target.value })}
                placeholder="email@exemple.com"
              />
            </div>
            <div>
              <Label htmlFor="subject">Objet (optionnel)</Label>
              <Input
                id="subject"
                value={emailForm.subject}
                onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
                placeholder="Laissez vide pour utiliser l'objet par défaut"
              />
            </div>
            <div>
              <Label htmlFor="message">Message personnalisé (optionnel)</Label>
              <Textarea
                id="message"
                value={emailForm.message}
                onChange={(e) => setEmailForm({ ...emailForm, message: e.target.value })}
                placeholder="Ajoutez un message personnalisé..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSendEmail} disabled={sending}>
              {sending ? 'Envoi...' : 'Envoyer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer {isInvoice ? 'cette facture' : 'ce devis'}{' '}
              {document.number} ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onDelete?.()
                setDeleteDialogOpen(false)
              }}
            >
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convertir en facture</DialogTitle>
            <DialogDescription>
              Voulez-vous convertir le devis {document.number} en facture ? Une nouvelle
              facture sera créée avec les mêmes informations.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => {
                onConvertToInvoice?.()
                setConvertDialogOpen(false)
              }}
            >
              <FileText className="mr-2 h-4 w-4" />
              Convertir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
