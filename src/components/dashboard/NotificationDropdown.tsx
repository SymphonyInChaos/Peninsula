import { AnimatePresence , motion } from "framer-motion";

const NotificationDropdown = ({ open }: { open: boolean }) => {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
          className="
            absolute right-0 top-12 w-72 
            bg-card shadow-xl rounded-xl border border-border
            p-4 z-50
          "
        >
          <h3 className="text-sm font-medium mb-3">Notifications</h3>

          <div className="space-y-3 text-sm">
            <div className="p-3 bg-accent rounded-lg">
              New order received.
            </div>
            <div className="p-3 bg-accent rounded-lg">
              Inventory is running low.
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NotificationDropdown;
