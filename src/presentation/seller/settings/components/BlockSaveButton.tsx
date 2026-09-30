import { AnimatePresence, motion as Motion } from 'framer-motion';

interface Props {
  /** Кнопка видна только когда у блока есть несохранённые изменения. */
  visible: boolean;
  saving: boolean;
  onClick: () => void;
}

/** Локальная кнопка сохранения блока: плавно появляется при изменениях. 12 §3, §7. */
export default function BlockSaveButton({ visible, saving, onClick }: Props) {
  return (
    <AnimatePresence initial={false}>
      {visible ? (
        <Motion.button
          type="button"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.15 }}
          disabled={saving}
          onClick={onClick}
          style={{
            ...styles.button,
            opacity: saving ? 0.7 : 1,
            cursor: saving ? 'default' : 'pointer',
          }}
        >
          {saving ? 'Сохранение…' : 'Сохранить'}
        </Motion.button>
      ) : null}
    </AnimatePresence>
  );
}

const styles: Record<string, React.CSSProperties> = {
  button: {
    width: '100%',
    marginTop: 12,
    padding: '14px',
    borderRadius: 14,
    border: 'none',
    backgroundColor: '#6C5DD3',
    color: '#fff',
    fontSize: 15,
    fontWeight: 800,
    boxShadow: '0 8px 20px rgba(108,93,211,0.25)',
  },
};
