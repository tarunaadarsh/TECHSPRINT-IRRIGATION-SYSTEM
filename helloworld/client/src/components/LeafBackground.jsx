import { motion } from "framer-motion";

const leaves = Array.from({ length: 15 });

const LeafBackground = () => {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {leaves.map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-6 h-6 bg-agri-green-500/30 rounded-full blur-sm"
          initial={{
            x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1920),
            y: -50,
            rotate: 0,
            opacity: 0
          }}
          animate={{
            y: (typeof window !== 'undefined' ? window.innerHeight : 1080) + 100,
            rotate: 360,
            opacity: [0, 1, 1, 0]
          }}
          transition={{
            duration: 12 + Math.random() * 6,
            delay: Math.random() * 5,
            repeat: Infinity,
            ease: "linear"
          }}
        />
      ))}
    </div>
  );
};

export default LeafBackground;

