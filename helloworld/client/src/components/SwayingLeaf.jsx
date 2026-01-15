import { motion } from "framer-motion";
import { Leaf } from "lucide-react";

const SwayingLeaf = ({ size = 32, className = "" }) => {
  return (
    <motion.div
      animate={{
        rotate: [-5, 5, -5],
        y: [0, -4, 0]
      }}
      transition={{
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut"
      }}
      className="inline-block"
    >
      <Leaf size={size} className={`text-agri-green-500 ${className}`} />
    </motion.div>
  );
};

export default SwayingLeaf;

